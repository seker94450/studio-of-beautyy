const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ACCESS_KEY_ID     = 'd507d9b6b8a4d0ed75d32abd75290b04';
const SECRET_ACCESS_KEY = '3470f2e82d451e4d33494f917a934f52f1d58f8f35b7690bb1834c9aecd95efb';
const ACCOUNT_ID        = 'f0ce5c80ec36db8652a44cdc5a2f737b';
const BUCKET            = 'studio-of-beauty';

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY }
});

const files = [
  { local: 'files/products/essentiel-brow-beige.pdf', remote: 'essentiel-brow-beige.pdf' },
  { local: 'files/products/essentiel-brow-gris.pdf',  remote: 'essentiel-brow-gris.pdf'  },
  { local: 'files/products/essentiel-lash-beige.pdf', remote: 'essentiel-lash-beige.pdf' },
  { local: 'files/products/essentiel-lash-gris.pdf',  remote: 'essentiel-lash-gris.pdf'  },
];

async function main() {
  for (const f of files) {
    const filePath = path.join(__dirname, f.local);
    if (!fs.existsSync(filePath)) { console.log(`⚠️  Introuvable : ${f.local}`); continue; }
    const size = Math.round(fs.statSync(filePath).size / 1024 / 1024);
    console.log(`\n⬆️  ${f.remote} (${size} MB) — génération URL...`);

    const url = await getSignedUrl(client, new PutObjectCommand({
      Bucket: BUCKET, Key: f.remote, ContentType: 'application/pdf'
    }), { expiresIn: 3600 });

    console.log(`   Upload via curl...`);
    const result = spawnSync('curl.exe', [
      '-X', 'PUT',
      '-H', 'Content-Type: application/pdf',
      '--data-binary', `@${filePath}`,
      '--progress-bar',
      url
    ], { stdio: 'inherit', maxBuffer: 1024 * 1024 * 1024 });

    if (result.status === 0) {
      console.log(`\n✅  ${f.remote} uploadé !`);
    } else {
      console.log(`\n❌  Erreur curl (code ${result.status})`);
    }
  }
  console.log('\nTerminé !');
}

main().catch(err => console.error('Erreur :', err.message));
