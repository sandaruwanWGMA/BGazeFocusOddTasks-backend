/**
 * s3.js
 * -----
 * AWS-S3 client + Multer-S3 upload helper, ready to be used in routes.
 */
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

AWS.config.update({
  accessKeyId    : process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region         : process.env.AWS_REGION,
});

const s3 = new AWS.S3();

const upload = multer({
  storage: multerS3({
    s3,
    bucket  : process.env.AWS_S3_BUCKET,
    acl     : 'public-read',
    key     : (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
    metadata: (_req, file, cb) => cb(null, { fieldName: file.fieldname }),
  }),
});

module.exports = { s3, upload }; 