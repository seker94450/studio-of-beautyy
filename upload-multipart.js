const fs = require('fs');
const path = require('path');
const https = require('https');

const CF_TOKEN   = process.env.CF_TOKEN;
const ACCOUNT_ID = 'f0ce5c80ec36db8652a44cdc5a2f737b';
const BUCKET     = 'studio-of-beauty';
const CHUNK_SIZE = 95 * 1024 * 1024; // 95 MB

function request(method, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: urlPath,
      method,
      headers: { 'Authorization': `Bearer ${CF_TOKEN}`, ...headers }
    };
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function uploadLargeFile(localPath, remoteName) {
  const filePath = path.join(__dirname, localPath);
  const fileBuffer = fs.readFileSync(filePath);
  const totalSize = fileBuffer.length;
  const base = `/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}`;

  // 1. Créer le multipart upload
  const createRes = await request('POST', `${base}/uploads?object-key=${remoteName}`, { 'Content-Length': 0 });
  const createData = JSON.parse(createRes.body);
  if (!createData.success) throw new Error('Création multipart échouée: ' + createRes.body);
  const uploadId = createData.result.uploadId;

  // 2. Uploader les parties
  const parts = [];
  let offset = 0;
  let partNumber = 1;
  while (offset < totalSize) {
    const chunk = fileBuffer.slice(offset, offset + CHUNK_SIZE);
    const pct = Math.round((offset / totalSize) * 100);
    process.stdout.write(`\r  Partie ${partNumber} — ${pct}% (${Math.round(offset/1024/1024)}MB / ${Math.round(totalSize/1024/1024)}MB)`);

    const partRes = await request('PUT', `${base}/uploads/${uploadId}?part=${partNumber}`,
      { 'Content-Type': 'application/octet-stream', 'Content-Length': chunk.length }, chunk);

    const partData = JSON.parse(partRes.body);
    if (!partData.success) throw new Error(`Partie ${partNumber} échouée: ` + partRes.body);
    parts.push({ partNumber, etag: partData.result.etag });

    offset += CHUNK_SIZE;
    partNumber++;
  }

  // 3. Compléter l'upload
  const completeBody = Buffer.from(JSON.stringify({ parts }));
  const completeRes = await request('POST', `${base}/uploads/${uploadId}/complete`,
    { 'Content-Type': 'application/json', 'Content-Length': completeBody.length }, completeBody);
  const completeData = JSON.parse(completeRes.body);
  if (!completeData.success) throw new Error('Completion échouée: ' + completeRes.body);
}

const files = [
  { local: 'files/products/essentiel-brow-beige.pdf', remote: 'essentiel-brow-beige.pdf' },
  { local: 'files/products/essentiel-brow-gris.pdf',  remote: 'essentiel-brow-gris.pdf'  },
  { local: 'files/products/essentiel-lash-beige.pdf', remote: 'essentiel-lash-beige.pdf' },
  { local: 'files/products/essentiel-lash-gris.pdf',  remote: 'essentiel-lash-gris.pdf'  },
];

async function main() {
  for (const f of files) {
    console.log(`\n⬆️  Upload : ${f.remote}`);
    try {
      await uploadLargeFile(f.local, f.remote);
      console.log(`\n✅  ${f.remote} uploadé !`);
    } catch (err) {
      console.log(`\n❌  Erreur : ${err.message}`);
    }
  }
  console.log('\n🎉 Tous les fichiers sont sur R2 !');
}

main();
