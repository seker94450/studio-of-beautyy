const { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ACCESS_KEY_ID     = 'd507d9b6b8a4d0ed75d32abd75290b04';
const SECRET_ACCESS_KEY = '3470f2e82d451e4d33494f917a934f52f1d58f8f35b7690bb1834c9aecd95efb';
const ACCOUNT_ID        = 'f0ce5c80ec36db8652a44cdc5a2f737b';
const BUCKET            = 'studio-of-beauty';

const agent = new https.Agent({ ciphers: 'DEFAULT@SECLEVEL=0', rejectUnauthorized: false });

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  requestHandler: new NodeHttpHandler({ httpsAgent: agent })
});

const files = [
  { local: 'files/products/essentiel-brow-beige.pdf', remote: 'essentiel-brow-beige.pdf' },
  { local: 'files/products/essentiel-brow-gris.pdf',  remote: 'essentiel-brow-gris.pdf'  },
  { local: 'files/products/essentiel-lash-beige.pdf', remote: 'essentiel-lash-beige.pdf' },
  { local: 'files/products/essentiel-lash-gris.pdf',  remote: 'essentiel-lash-gris.pdf'  },
];

const CHUNK = 50 * 1024 * 1024; // 50 MB

async function uploadFile(localPath, key) {
  const filePath = path.join(__dirname, localPath);
  if (!fs.existsSync(filePath)) { console.log(`⚠️  Introuvable : ${localPath}`); return; }
  const buf = fs.readFileSync(filePath);
  const total = buf.length;
  console.log(`⬆️  ${key} (${Math.round(total/1024/1024)} MB)`);

  const { UploadId } = await client.send(new CreateMultipartUploadCommand({ Bucket: BUCKET, Key: key, ContentType: 'application/pdf' }));
  const parts = [];
  let offset = 0, partNumber = 1;
  while (offset < total) {
    const chunk = buf.slice(offset, offset + CHUNK);
    process.stdout.write(`\r  Partie ${partNumber} — ${Math.round(offset/total*100)}%`);
    const { ETag } = await client.send(new UploadPartCommand({ Bucket: BUCKET, Key: key, UploadId, PartNumber: partNumber, Body: chunk }));
    parts.push({ PartNumber: partNumber, ETag });
    offset += CHUNK; partNumber++;
  }
  await client.send(new CompleteMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId, MultipartUpload: { Parts: parts } }));
  console.log(`\n✅  ${key} uploadé !`);
}

async function upload() {
  for (const f of files) await uploadFile(f.local, f.remote);
  console.log('\nTous les fichiers sont sur R2 !');
}

upload().catch(err => console.error('Erreur :', err.message));
