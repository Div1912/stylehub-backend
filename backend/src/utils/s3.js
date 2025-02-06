const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const bucketName = process.env.AWS_BUCKET_NAME;

// Upload file to S3
exports.uploadToS3 = async (file) => {
  try {
    const fileExtension = file.originalname.split('.').pop();
    const key = `${uuidv4()}.${fileExtension}`;

    const params = {
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read'
    };

    const result = await s3.upload(params).promise();
    return {
      Location: result.Location,
      Key: result.Key
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
};

// Delete file from S3
exports.deleteFromS3 = async (key) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: key
    };

    await s3.deleteObject(params).promise();
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw error;
  }
};

// Get signed URL for temporary access
exports.getSignedUrl = async (key, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: key,
      Expires: expiresIn
    };

    return await s3.getSignedUrlPromise('getObject', params);
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw error;
  }
};

// Upload multiple files
exports.uploadMultipleToS3 = async (files) => {
  try {
    const uploadPromises = files.map(file => this.uploadToS3(file));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading multiple files to S3:', error);
    throw error;
  }
};

// Delete multiple files
exports.deleteMultipleFromS3 = async (keys) => {
  try {
    const deletePromises = keys.map(key => this.deleteFromS3(key));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting multiple files from S3:', error);
    throw error;
  }
};
