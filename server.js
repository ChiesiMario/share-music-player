const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mm = require('music-metadata');

const app = express();
const port = 8000;
const UPLOAD_PASSWORD = 'admin'; // 預設上傳密碼

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
    const urlObj = new URL(fileUrl, `http://localhost:${port}`);
    const filePath = path.join(__dirname, decodeURIComponent(urlObj.pathname));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    const metadata = await mm.parseFile(filePath);
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

    res.json(meta);
  } catch (err) {
    console.error('Error in /metadata endpoint:', err);
    res.status(500).json({ error: 'Failed to parse metadata' });
  }
});
// --- File Cleanup Mechanism ---
// Check and delete files older than 36 hours
const MAX_AGE_MS = 36 * 60 * 60 * 1000;

function cleanupOldFiles() {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error('Error reading uploads directory for cleanup:', err);
      return;
    }
    
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        
        if (now - stats.mtimeMs > MAX_AGE_MS) {
          fs.unlink(filePath, err => {
            if (err) console.error(`Failed to delete old file ${file}:`, err);
            else console.log(`Deleted old file: ${file}`);
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
