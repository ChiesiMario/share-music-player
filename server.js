const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mm = require('music-metadata');
require('dotenv').config();

const app = express();
const port = 8000;
const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD || 'admin'; // 預設上傳密碼

// Initialize cache directory
const CACHE_DIR = path.join(__dirname, '.cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR);
}

// Enable CORS with exposed headers for Range requests
app.use(cors({
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
}));
app.use(express.json());

// Serve the frontend static files
app.use(express.static(path.join(__dirname)));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure Multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Generate a unique filename using timestamp while preserving original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB file size limit
});

// Password verification endpoint
app.post('/verify-password', (req, res) => {
  if (req.body.password === UPLOAD_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Check file existence API endpoint for instant upload
app.post('/check-file', (req, res) => {
  const { md5, ext, password } = req.body;
  
  if (password !== UPLOAD_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Incorrect password' });
  }

  if (!md5 || !ext) {
    return res.status(400).json({ error: 'Missing md5 or ext' });
  }

  // Prevent Path Traversal: ensure md5 and ext only contain alphanumeric chars, dots, and hyphens
  if (!/^[a-f0-9]+$/i.test(md5) || !/^\.[a-z0-9]+$/i.test(ext)) {
    return res.status(400).json({ error: 'Invalid md5 or ext format' });
  }

  const newFilename = md5 + ext;
  const finalPath = path.join(uploadDir, newFilename);

  if (fs.existsSync(finalPath)) {
    // File already exists, update mtime to reset the 36-hour timer
    const now = new Date();
    fs.utimesSync(finalPath, now, now);
    const fileUrl = `./uploads/${newFilename}`;
    return res.json({ exists: true, url: fileUrl });
  } else {
    return res.json({ exists: false });
  }
});

// Upload API endpoint
app.post('/upload', upload.single('musicFile'), async (req, res) => {
  const password = req.body.password;

  if (password !== UPLOAD_PASSWORD) {
    if (req.file) {
      fs.unlinkSync(req.file.path); // 刪除未經授權的檔案
    }
    return res.status(401).json({ error: 'Unauthorized: Incorrect password' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const tempPath = req.file.path;
  
  // Try to parse metadata
  let meta = null;
  try {
    const metadata = await mm.parseFile(tempPath);
    meta = metadata.common;
    if (meta && meta.picture && meta.picture.length > 0) {
      const pic = meta.picture[0];
      meta.coverData = `data:${pic.format};base64,${Buffer.from(pic.data).toString('base64')}`;
      delete meta.picture; // Don't send raw buffer array over JSON
    }
  } catch (err) {
    console.error('Error parsing metadata:', err);
  }

  const hash = crypto.createHash('md5');
  const stream = fs.createReadStream(tempPath);

  stream.on('data', (data) => {
    hash.update(data);
  });

  stream.on('end', () => {
    const md5Hex = hash.digest('hex');
    const ext = path.extname(req.file.originalname);
    const newFilename = md5Hex + ext;
    const finalPath = path.join(uploadDir, newFilename);

    if (fs.existsSync(finalPath)) {
      // File already exists, update mtime to reset the 36-hour timer
      const now = new Date();
      fs.utimesSync(finalPath, now, now);
      // Delete the temp file since we don't need it
      fs.unlinkSync(tempPath);
    } else {
      // Rename temp file to final md5 name
      fs.renameSync(tempPath, finalPath);
    }

    const fileUrl = `./uploads/${newFilename}`;

    res.json({
      message: 'File uploaded successfully',
      url: fileUrl,
      filename: req.file.originalname,
      metadata: meta
    });
  });

  stream.on('error', (err) => {
    console.error('Error hashing file:', err);
    res.status(500).json({ error: 'Error processing file' });
  });
});

// Metadata API endpoint for direct fetching of file tags
app.get('/metadata', async (req, res) => {
  const fileUrl = req.query.url;
  if (!fileUrl) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const urlHash = crypto.createHash('md5').update(fileUrl).digest('hex');
    const cacheFile = path.join(CACHE_DIR, `${urlHash}.json`);
    
    if (fs.existsSync(cacheFile)) {
      console.log(`Cache hit: reading from local cache for ${fileUrl}`);
      const cachedData = fs.readFileSync(cacheFile, 'utf-8');
      return res.json(JSON.parse(cachedData));
    }

    console.log(`Cache miss: fetching from remote for ${fileUrl}`);
    let metadata;
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      try {
        const parsedUrl = new URL(fileUrl);
        const hostname = parsedUrl.hostname;
        // SSRF Protection: Block localhost, loopback, and private IPv4 address spaces
        const forbiddenPattern = /^(localhost|127\.|169\.254\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;
        if (forbiddenPattern.test(hostname)) {
          return res.status(403).json({ error: 'SSRF protection: Cannot fetch from internal or reserved IPs' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      const https = fileUrl.startsWith('https') ? require('https') : require('http');
      metadata = await new Promise((resolve, reject) => {
        https.get(fileUrl, async (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            // Very basic redirect handling
            https.get(response.headers.location, async (res2) => {
              try { resolve(await mm.parseStream(res2, res2.headers['content-type'])); } catch (e) { reject(e); }
            }).on('error', reject);
          } else {
            try { resolve(await mm.parseStream(response, response.headers['content-type'])); } catch (e) { reject(e); }
          }
        }).on('error', reject);
      });
    } else {
      const urlObj = new URL(fileUrl, `http://localhost:${port}`);
      
      // Prevent Path Traversal: ensure the resolved path strictly stays within the uploads directory
      const normalizedPath = path.normalize(decodeURIComponent(urlObj.pathname));
      const filePath = path.join(__dirname, normalizedPath);
      
      if (!filePath.startsWith(__dirname)) {
        return res.status(403).json({ error: 'Forbidden path' });
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        return res.status(404).json({ error: 'File not found or is a directory' });
      }
      metadata = await mm.parseFile(filePath);
    }
    
    const common = metadata.common;
    const meta = {
      title: common.title,
      artist: common.artist,
      album: common.album,
      year: common.year || common.date || common.originalyear || ''
    };

    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      meta.coverData = `data:${pic.format};base64,${Buffer.from(pic.data).toString('base64')}`;
    }

    fs.writeFileSync(cacheFile, JSON.stringify(meta), 'utf-8');
    res.json(meta);
  } catch (err) {
    console.error('Error in /metadata endpoint:', err);
    res.status(500).json({ error: 'Failed to parse metadata' });
  }
});
// --- File Cleanup Mechanism ---
// Check and delete files older than 36 hours for uploads, and 180 days for cache
const MAX_AGE_MS_UPLOADS = 36 * 60 * 60 * 1000;
const MAX_AGE_MS_CACHE = 180 * 24 * 60 * 60 * 1000;

function cleanupOldFiles() {
  const now = Date.now();

  // Cleanup uploads
  fs.readdir(uploadDir, (err, files) => {
    if (err) return console.error('Error reading uploads directory for cleanup:', err);
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > MAX_AGE_MS_UPLOADS) {
          fs.unlink(filePath, err => {
            if (err) console.error(`Failed to delete old upload file ${file}:`, err);
            else console.log(`Deleted old upload file: ${file}`);
          });
        }
      });
    });
  });

  // Cleanup cache
  fs.readdir(CACHE_DIR, (err, files) => {
    if (err) return console.error('Error reading cache directory for cleanup:', err);
    files.forEach(file => {
      const filePath = path.join(CACHE_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > MAX_AGE_MS_CACHE) {
          fs.unlink(filePath, err => {
            if (err) console.error(`Failed to delete old cache file ${file}:`, err);
            else console.log(`Deleted old cache file: ${file}`);
          });
        }
      });
    });
  });
}

// Run cleanup every hour
setInterval(cleanupOldFiles, 60 * 60 * 1000);
// Also run once on startup
cleanupOldFiles();

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log('You can now upload music files and they will be stored in the "uploads" directory.');
});
