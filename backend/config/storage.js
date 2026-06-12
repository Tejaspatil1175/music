const { Storage } = require("@google-cloud/storage");
const path = require("path");

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  keyFilename: path.resolve(process.env.GCS_KEY_FILE),
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

const uploadToGCS = async (localFilePath, destinationPath, contentType) => {
  await bucket.upload(localFilePath, {
    destination: destinationPath,
    metadata: { contentType },
    public: true,
  });
  return `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${destinationPath}`;
};

const deleteFromGCS = async (fileUrl) => {
  try {
    const fileName = fileUrl.replace(
      `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/`,
      ""
    );
    await bucket.file(fileName).delete();
  } catch (err) {
    console.error("GCS delete error:", err.message);
  }
};

module.exports = { bucket, uploadToGCS, deleteFromGCS };
