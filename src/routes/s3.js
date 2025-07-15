/**
 * s3 routes
 * ---------
 * Auth-protected AWS S3 upload / listing / signed-URL / delete endpoints.
 * Mounted at /s3         (see src/app.js)
 *
 * Requirements:
 *   npm i express multer multer-s3 aws-sdk @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */
const express = require('express');
const router  = express.Router();

const multer      = require('multer');
const multerS3    = require('multer-s3');
const AWSv2       = require('aws-sdk');                                   // multer-s3 still on v2
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');     // v3
const { getSignedUrl }               = require('@aws-sdk/s3-request-presigner');

const { authenticateToken } = require('../utils/auth');                   // your JWT helper

/* ------------------------------------------------------------------ */
/*  v2 client (needed only for multer-s3)                              */
/* ------------------------------------------------------------------ */
AWSv2.config.update({
  accessKeyId    : process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region         : process.env.AWS_REGION,
});
const s3v2 = new AWSv2.S3();

/*  Multer storage for SMALL files (JSON, images, etc.)                */
const upload = multer({
  storage: multerS3({
    s3     : s3v2,
    bucket : process.env.AWS_S3_BUCKET,
    acl    : 'public-read',                                  // remove if you want private
    key    : (_req, file, cb) =>
        cb(null, `${Date.now()}-${file.originalname}`),
    metadata: (_req, file, cb) =>
        cb(null, { fieldName: file.fieldname }),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },                     // 5 MB safety guard
});

/* ------------------------------------------------------------------ */
/*  (1) DIRECT UPLOAD – small files only                               */
/* ------------------------------------------------------------------ */
router.post(
    '/upload',
    authenticateToken,
    upload.single('file'),
    (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: 'No file received' });
      }
      res.json({
        message: '✅ File uploaded',
        key    : req.file.key,
        url    : req.file.location,
      });
    }
);

/* ------------------------------------------------------------------ */
/*  (2) LIST OBJECTS                                                   */
/* ------------------------------------------------------------------ */
router.get('/files', authenticateToken, async (_req, res) => {
  try {
    const data = await s3v2.listObjectsV2({
      Bucket: process.env.AWS_S3_BUCKET,
    }).promise();
    res.json(data.Contents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

/* ------------------------------------------------------------------ */
/*  (3) SIGNED  DOWNLOAD  URL                                          */
/* ------------------------------------------------------------------ */
router.get('/file/:key', authenticateToken, (req, res) => {
  const url = s3v2.getSignedUrl('getObject', {
    Bucket : process.env.AWS_S3_BUCKET,
    Key    : req.params.key,
    Expires: 60 * 60,        // 1 hour
  });
  res.json({ url });
});

/* ------------------------------------------------------------------ */
/*  (4) DELETE OBJECT                                                 */
/* ------------------------------------------------------------------ */
router.delete('/file/:key', authenticateToken, async (req, res) => {
  try {
    await s3v2.deleteObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key   : req.params.key,
    }).promise();
    res.json({ message: '✅ File deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

/* ------------------------------------------------------------------ */
/*  (5) PRESIGN  PUT  (large uploads)                                  */
/* ------------------------------------------------------------------ */
router.post('/presign', authenticateToken, async (req, res) => {
  const { fileName, contentType } = req.body || {};
  if (!fileName || !contentType) {
    return res.status(400).json({ error: 'fileName & contentType required' });
  }

  try {
    const key = `uploads/${Date.now()}-${fileName}`;

    const s3client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId    : process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const command = new PutObjectCommand({
      Bucket     : process.env.AWS_S3_BUCKET,
      Key        : key,
      ContentType: contentType,
      ACL        : 'public-read',      // remove for private
    });

    const url = await getSignedUrl(s3client, command, { expiresIn: 600 }); // 10 min
    res.json({ url, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create presigned URL' });
  }
});

module.exports = router;