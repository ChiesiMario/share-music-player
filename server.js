const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 8000;
const UPLOAD_PASSWORD = 'admin'; // 預設上傳密碼

// Enable CORS
app.use(cors());

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
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
});

// Upload API endpoint
app.post('/upload', upload.single('musicFile'), (req, res) => {
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

  // Construct the URL to access the uploaded file
  // Using relative path so it works regardless of domain/port
  const fileUrl = `./uploads/${req.file.filename}`;

  res.json({
    message: 'File uploaded successfully',
    url: fileUrl,
    filename: req.file.originalname
  });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log('You can now upload music files and they will be stored in the "uploads" directory.');
});
