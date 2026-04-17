const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
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

async function generate() {
  const links = [];
  for (const f of files) {
    const url = await getSignedUrl(client, new PutObjectCommand({
      Bucket: BUCKET,
      Key: f.remote,
      ContentType: 'application/pdf'
    }), { expiresIn: 3600 });
    links.push({ local: f.local, remote: f.remote, url });
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Upload R2</title>
<style>body{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;padding:20px;}
.file{margin:20px 0;padding:16px;border:1px solid #ddd;border-radius:8px;}
button{background:#2a2826;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;}
.status{margin-top:8px;font-size:14px;}</style>
</head>
<body>
<h2>Upload des carnets vers R2</h2>
<p>Sélectionne chaque fichier et clique Upload.</p>
${links.map(l => `
<div class="file" id="div-${l.remote}">
  <strong>${l.remote}</strong><br>
  <input type="file" accept="application/pdf" id="file-${l.remote}">
  <button onclick="upload('${l.remote}', '${l.url}')">Upload</button>
  <div class="status" id="status-${l.remote}"></div>
</div>`).join('')}
<script>
async function upload(name, url) {
  const input = document.getElementById('file-' + name);
  const status = document.getElementById('status-' + name);
  if (!input.files[0]) { status.textContent = '⚠️ Sélectionne un fichier'; return; }
  status.textContent = '⬆️ Upload en cours...';
  try {
    const resp = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: input.files[0]
    });
    if (resp.ok) {
      status.textContent = '✅ Uploadé avec succès !';
      status.style.color = 'green';
    } else {
      status.textContent = '❌ Erreur : ' + resp.status + ' ' + await resp.text();
      status.style.color = 'red';
    }
  } catch(e) {
    status.textContent = '❌ ' + e.message;
    status.style.color = 'red';
  }
}
</script>
</body></html>`;

  fs.writeFileSync(path.join(__dirname, 'upload.html'), html);
  console.log('✅ Fichier upload.html créé ! Ouvre-le dans ton navigateur.');
}

generate().catch(err => console.error('Erreur :', err.message));
