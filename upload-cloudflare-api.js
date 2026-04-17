const fs = require('fs');
const path = require('path');
const https = require('https');

const CF_TOKEN   = process.env.CF_TOKEN;
const ACCOUNT_ID = 'f0ce5c80ec36db8652a44cdc5a2f737b';
const BUCKET     = 'studio-of-beauty';

const files = [
  { local: 'files/products/essentiel-brow-beige.pdf', remote: 'essentiel-brow-beige.pdf' },
  { local: 'files/products/essentiel-brow-gris.pdf',  remote: 'essentiel-brow-gris.pdf'  },
  { local: 'files/products/essentiel-lash-beige.pdf', remote: 'essentiel-lash-beige.pdf' },
  { local: 'files/products/essentiel-lash-gris.pdf',  remote: 'essentiel-lash-gris.pdf'  },
];

function uploadFile(localPath, remoteName) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, localPath);
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fileBuffer.length;

    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${remoteName}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CF_TOKEN}`,
        'Content-Type': 'application/pdf',
        'Content-Length': fileSize
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);

    // Upload en streaming avec progression
    let uploaded = 0;
    const chunkSize = 1024 * 1024; // 1MB
    let offset = 0;
    const interval = setInterval(() => {
      const pct = Math.round((uploaded / fileSize) * 100);
      process.stdout.write(`\r  ${pct}% (${Math.round(uploaded/1024/1024)}MB / ${Math.round(fileSize/1024/1024)}MB)`);
    }, 500);

    req.write(fileBuffer);
    req.end();

    req.on('finish', () => clearInterval(interval));
    res_end_hook: req.on('close', () => clearInterval(interval));
  });
}

async function main() {
  for (const f of files) {
    console.log(`\n⬆️  Upload : ${f.remote}`);
    try {
      await uploadFile(f.local, f.remote);
      console.log(`\n✅  ${f.remote} uploadé !`);
    } catch (err) {
      console.log(`\n❌  Erreur : ${err.message}`);
    }
  }
  console.log('\n🎉 Terminé !');
}

main();
