// ============================================
// UPLOAD MIDDLEWARE
// Handles file uploads (profile pictures)
// Uses multer for multipart/form-data
// ============================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// ENSURE UPLOAD DIRECTORY EXISTS
// ============================================
const uploadDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✅ Upload directory created:', uploadDir);
}

// ============================================
// CONFIGURE STORAGE
// Files saved with unique names
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: userId_timestamp.extension
    const userId = req.user.user_id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `user_${userId}_${timestamp}${ext}`;
    cb(null, filename);
  },
});

// ============================================
// FILE FILTER
// Only allow image files
// ============================================
const fileFilter = (req, file, cb) => {
  // Allowed extensions
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// ============================================
// MULTER CONFIGURATION
// ============================================
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

// ============================================
// EXPORT
// ============================================
module.exports = upload;