const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const {
  CELLAR_ADDON_HOST,
  CELLAR_ADDON_KEY_ID,
  CELLAR_ADDON_KEY_SECRET,
  CELLAR_BUCKET,
} = process.env;

const PRESIGNED_URL_EXPIRES_IN = parseInt(process.env.PRESIGNED_URL_EXPIRES_IN || '3600', 10);

let client = null;

function getClient() {
  if (!CELLAR_ADDON_HOST || !CELLAR_ADDON_KEY_ID || !CELLAR_ADDON_KEY_SECRET || !CELLAR_BUCKET) {
    throw Object.assign(
      new Error('Cellar configuration is missing (CELLAR_ADDON_HOST, CELLAR_ADDON_KEY_ID, CELLAR_ADDON_KEY_SECRET, CELLAR_BUCKET)'),
      { status: 500 },
    );
  }
  if (!client) {
    client = new S3Client({
      endpoint: `https://${CELLAR_ADDON_HOST}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: CELLAR_ADDON_KEY_ID,
        secretAccessKey: CELLAR_ADDON_KEY_SECRET,
      },
      forcePathStyle: true,
    });
  }
  return client;
}

async function storePdf(pdfBuffer, key) {
  const s3 = getClient();
  await s3.send(new PutObjectCommand({
    Bucket: CELLAR_BUCKET,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  }));
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: CELLAR_BUCKET, Key: key }),
    { expiresIn: PRESIGNED_URL_EXPIRES_IN },
  );
  return { bucket: CELLAR_BUCKET, key, url, expiresIn: PRESIGNED_URL_EXPIRES_IN };
}

module.exports = { storePdf };
