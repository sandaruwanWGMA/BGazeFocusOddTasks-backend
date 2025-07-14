/**
 * s3 routes
 * ---------
 * Auth-protected AWS S3 upload / listing / download-URL / delete endpoints.
 * Mounted at /s3 (see src/app.js).
 */
const express = require('express');
const router  = express.Router();
const { s3, upload } = require('../utils/s3');
const { authenticateToken } = require('../utils/auth');

// (1) UPLOAD  multipart/form-data field "file"
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  res.json({ message: '✅ File uploaded', key: req.file.key, url: req.file.location });
});

// (2) LIST OBJECTS
router.get('/files', authenticateToken, async (_req, res) => {
  try {
    const data = await s3.listObjectsV2({ Bucket: process.env.AWS_S3_BUCKET }).promise();
    res.json(data.Contents);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// (3) SIGNED DOWNLOAD URL
router.get('/file/:key', authenticateToken, (req, res) => {
  const url = s3.getSignedUrl('getObject', {
    Bucket : process.env.AWS_S3_BUCKET,
    Key    : req.params.key,
    Expires: 60 * 60, // 1 hour
  });
  res.json({ url });
});

// (4) DELETE OBJECT
router.delete('/file/:key', authenticateToken, async (req, res) => {
  try {
    await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: req.params.key }).promise();
    res.json({ message: '✅ File deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router; 