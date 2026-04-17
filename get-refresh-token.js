const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3030/callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
});

console.log('\nOuvre ce lien dans ton navigateur :\n');
console.log(authUrl);
console.log('\nEn attente du callback...\n');

const server = http.createServer(async (req, res) => {
  const { code } = url.parse(req.url, true).query;
  if (!code) { res.end('Pas de code'); return; }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n✅ REFRESH TOKEN :\n');
    console.log(tokens.refresh_token);
    console.log('\nCopie ce token dans Railway comme GMAIL_REFRESH_TOKEN\n');
    res.end('Token obtenu ! Tu peux fermer cette fenêtre.');
  } catch (err) {
    console.error('Erreur :', err.message);
    res.end('Erreur : ' + err.message);
  }
  server.close();
});

server.listen(3030);
