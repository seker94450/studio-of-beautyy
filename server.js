const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'studioofbeauty_admin';
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || null;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || null;
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Stockage temporaire des commandes PayPal en attente
const pendingPaypalOrders = new Map();

const R2_BASE_URL = process.env.R2_BASE_URL || 'https://pub-7f197ac13eac4cfdb1c383886c9b0100.r2.dev';

// Mapping slug -> nom du fichier sur R2
const PRODUCT_FILES = {
  'brow-beige': 'essentiel-brow-beige.pdf',
  'brow-gray':  'essentiel-brow-gris.pdf',
  'lash-beige': 'essentiel-lash-beige.pdf',
  'lash-gray':  'essentiel-lash-gris.pdf'
};

const GUIDE_FILE = path.join(__dirname, 'files/guide_studio_of_beauty.pdf');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES users(id),
      items TEXT NOT NULL,
      total REAL NOT NULL,
      "createdAt" TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS download_tokens (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      file_key TEXT NOT NULL,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);
}

initDB().then(() => {
  console.log('Base de données initialisée');
}).catch(err => {
  console.error('Erreur init DB:', err);
  process.exit(1);
});

app.use(cors());
app.use(express.json());

// ── DOWNLOAD TOKENS ───────────────────────────────────────────────────────────
async function createProductDownloadTokens(email, items) {
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const tokens = [];

  const slugsAdded = new Set();
  for (const item of items) {
    const slug = item.slug;
    if (slugsAdded.has(slug) || !PRODUCT_FILES[slug]) continue;
    const productToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO download_tokens (token, file_key, email, expires_at) VALUES ($1, $2, $3, $4)`,
      [productToken, slug, email, expiresAt]
    );
    tokens.push({ label: item.title, token: productToken });
    slugsAdded.add(slug);
  }

  return tokens;
}

// ── EMAIL ─────────────────────────────────────────────────────────────────────
function createGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost:3030/callback'
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

async function sendOrderEmail(toEmail, items) {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_REFRESH_TOKEN) {
    console.warn('[Email] Non configuré — GMAIL_CLIENT_ID ou GMAIL_REFRESH_TOKEN manquant.');
    return;
  }

  const productListHtml = items.map(i =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #ece9e4;">${i.title}</td><td style="padding:8px 0;border-bottom:1px solid #ece9e4;text-align:right;">x${i.quantity} — ${i.price}</td></tr>`
  ).join('');

  // Pièces jointes : guide + carnets achetés
  const attachments = [];

  if (fs.existsSync(GUIDE_FILE)) {
    attachments.push({
      content: fs.readFileSync(GUIDE_FILE).toString('base64'),
      filename: 'Guide_Studio_of_Beauty.pdf',
      type: 'application/pdf',
      disposition: 'attachment'
    });
  } else {
    console.warn('[Email] Guide introuvable :', GUIDE_FILE);
  }

  const slugsAdded = new Set();
  for (const item of items) {
    const slug = item.slug;
    if (slugsAdded.has(slug) || !PRODUCT_FILES[slug]) continue;
    const filename = PRODUCT_FILES[slug];
    const localPath = path.join(__dirname, 'files', filename);
    try {
      let buffer;
      if (fs.existsSync(localPath)) {
        buffer = fs.readFileSync(localPath);
      } else {
        const r2Url = `${R2_BASE_URL}/${filename}`;
        console.log('[Email] Téléchargement depuis R2 :', r2Url);
        const resp = await fetch(r2Url);
        if (!resp.ok) throw new Error(`R2 ${resp.status}`);
        buffer = Buffer.from(await resp.arrayBuffer());
      }
      attachments.push({ content: buffer.toString('base64'), filename, type: 'application/pdf', disposition: 'attachment' });
    } catch (err) {
      console.warn('[Email] Carnet introuvable :', filename, err.message);
    }
    slugsAdded.add(slug);
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:40px 20px;background:#f5f0ea;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="background:#2a2826;color:#fff;padding:32px;text-align:center;letter-spacing:0.25em;font-size:12px;text-transform:uppercase;">
      Studio of Beauty
    </div>
    <div style="padding:36px 40px;color:#2a2826;">
      <h2 style="font-weight:400;font-size:22px;margin:0 0 12px;">Merci pour votre commande&nbsp;!</h2>
      <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Votre carnet digital ainsi que le guide d'utilisation sont joints à cet email en pièce jointe.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px;">
        ${productListHtml}
      </table>
      <p style="font-size:13px;color:#999;margin:0;">
        Une question ? Écrivez-nous à
        <a href="mailto:studioofbeautyy@gmail.com" style="color:#2a2826;">studioofbeautyy@gmail.com</a>
      </p>
    </div>
    <div style="background:#f5f0ea;padding:20px;text-align:center;font-size:11px;color:#aaa;letter-spacing:0.1em;">
      STUDIO OF BEAUTY &middot; studioofbeautyy@gmail.com
    </div>
  </div>
</body>
</html>`;

  try {
    const transporter = nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true });
    const info = await transporter.sendMail({
      from: `"Studio of Beauty" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: 'Votre commande Studio of Beauty — Vos carnets digitaux',
      html,
      attachments
    });
    const raw = info.message.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const gmail = createGmailClient();
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    console.log('[Email] Envoyé à', toEmail);
  } catch (err) {
    console.error('[Email] Erreur envoi :', err.message);
  }
}

// ── TÉLÉCHARGEMENT SÉCURISÉ ───────────────────────────────────────────────────
app.get('/api/download/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM download_tokens WHERE token = $1`,
      [token]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).send('Lien invalide.');
    if (new Date(row.expires_at) < new Date()) return res.status(410).send('Ce lien a expiré. Contactez-nous à studioofbeautyy@gmail.com');

    const fileKey = row.file_key;
    const filename = PRODUCT_FILES[fileKey];
    if (!filename) return res.status(404).send('Fichier introuvable. Contactez-nous à studioofbeautyy@gmail.com');

    res.redirect(`${R2_BASE_URL}/${filename}`);
  } catch (err) {
    console.error('[Download] Erreur :', err.message);
    res.status(500).send('Erreur serveur.');
  }
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
function serializeUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    createdAt: user.createdAt
  };
}

function requireAdmin(req, res, next) {
  const token = req.header('x-admin-token') || req.query.token;
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/signup', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !lastName || !email || !password)
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });

  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = bcrypt.hashSync(password, 10);
  const createdAt = new Date().toISOString();

  try {
    const result = await pool.query(
      `INSERT INTO users ("firstName", "lastName", email, "passwordHash", "createdAt") VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [firstName.trim(), lastName.trim(), normalizedEmail, passwordHash, createdAt]
    );
    const user = { id: result.rows[0].id, firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, createdAt };
    res.json({ user: serializeUser(user) });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Tous les champs sont requis.' });

  const normalizedEmail = email.toLowerCase().trim();
  try {
    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [normalizedEmail]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.passwordHash))
      return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
    res.json({ user: serializeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, "firstName", "lastName", email, "createdAt" FROM users ORDER BY "createdAt" DESC`);
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, "firstName", "lastName", email, "createdAt" FROM users ORDER BY "createdAt" DESC`);
    const rows = result.rows;
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - Utilisateurs inscrits</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; background: #f5f5f5; }
    h1 { margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { padding: 12px 10px; border: 1px solid #ddd; text-align: left; }
    th { background: #000; color: #fff; }
    tr:nth-child(even) { background: #fafafa; }
  </style>
</head>
<body>
  <h1>Utilisateurs inscrits</h1>
  <table>
    <thead><tr><th>ID</th><th>Nom</th><th>E-mail</th><th>Date d'inscription</th></tr></thead>
    <tbody>
      ${rows.map(user => `
        <tr>
          <td>${user.id}</td>
          <td>${user.firstName} ${user.lastName}</td>
          <td>${user.email}</td>
          <td>${new Date(user.createdAt).toLocaleString('fr-FR')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur.');
  }
});

// ── TEST EMAIL ────────────────────────────────────────────────────────────────
app.get('/api/test-email', async (req, res) => {
  const to = req.query.to;
  if (!to) return res.status(400).json({ error: 'Paramètre ?to=email manquant' });
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_REFRESH_TOKEN) {
    return res.status(503).json({ error: 'Gmail API non configuré' });
  }
  try {
    const transporter = nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true });
    const info = await transporter.sendMail({
      from: `"Studio of Beauty" <${process.env.GMAIL_USER}>`,
      to,
      subject: 'Test email Studio of Beauty',
      text: 'Si vous recevez cet email, la configuration fonctionne !'
    });
    const raw = info.message.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const gmail = createGmailClient();
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    res.json({ success: true, message: `Email envoyé à ${to}` });
  } catch (err) {
    console.error('[Test email] Erreur :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── TEST COMMANDE EMAIL ───────────────────────────────────────────────────────
app.get('/api/test-order-email', async (req, res) => {
  const to = req.query.to;
  const slug = req.query.slug || 'brow-beige';
  if (!to) return res.status(400).json({ error: 'Paramètre ?to=email manquant' });
  try {
    await sendOrderEmail(to, [{ slug, title: 'L\'Essentiel Brow Beige', price: '8,95 €', quantity: 1 }]);
    res.json({ success: true, message: `Email de commande envoyé à ${to} avec le carnet ${slug}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── STRIPE ELEMENTS ───────────────────────────────────────────────────────────
app.post('/api/checkout/stripe/intent', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe non configuré.' });
  const { items, userEmail } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Panier vide.' });

  const amount = items.reduce((sum, item) => {
    return sum + Math.round(parseFloat(item.price.replace(',', '.').replace(/[^0-9.]/g, '')) * 100) * item.quantity;
  }, 0);

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      metadata: {
        userEmail: userEmail || '',
        items: JSON.stringify(items.map(i => ({ slug: i.slug, title: i.title, price: i.price, quantity: i.quantity })))
      }
    });
    res.json({
      clientSecret: paymentIntent.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur Stripe.' });
  }
});

app.post('/api/checkout/stripe/after-payment', async (req, res) => {
  const { paymentIntentId } = req.body;
  if (!paymentIntentId || !stripe) return res.status(400).json({ error: 'ID manquant.' });
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status === 'succeeded' || intent.status === 'processing') {
      const userEmail = intent.metadata?.userEmail;
      const items = intent.metadata?.items ? JSON.parse(intent.metadata.items) : [];
      if (userEmail) await sendOrderEmail(userEmail, items);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Paiement non confirmé.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur.' });
  }
});

// ── STRIPE SEPA DIRECT DEBIT ──────────────────────────────────────────────────
app.post('/api/checkout/stripe/sepa-intent', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe non configuré.' });
  const { items, userEmail } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Panier vide.' });

  const amount = items.reduce((sum, item) => {
    return sum + Math.round(parseFloat(item.price.replace(',', '.').replace(/[^0-9.]/g, '')) * 100) * item.quantity;
  }, 0);

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      payment_method_types: ['sepa_debit'],
      metadata: {
        userEmail: userEmail || '',
        items: JSON.stringify(items.map(i => ({ slug: i.slug, title: i.title, price: i.price, quantity: i.quantity })))
      }
    });
    res.json({
      clientSecret: paymentIntent.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur Stripe SEPA.' });
  }
});

// ── STRIPE CHECKOUT (conservé pour compatibilité) ──────────────────────────────
app.post('/api/checkout/stripe', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe non configuré.' });
  const { items, userEmail } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Panier vide.' });

  const line_items = items.map(item => ({
    price_data: {
      currency: 'eur',
      product_data: { name: item.title },
      unit_amount: Math.round(parseFloat(item.price.replace(',', '.').replace(/[^0-9.]/g, '')) * 100)
    },
    quantity: item.quantity
  }));

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      customer_email: userEmail || undefined,
      metadata: {
        userEmail: userEmail || '',
        items: JSON.stringify(items.map(i => ({ slug: i.slug, title: i.title, price: i.price, quantity: i.quantity })))
      },
      success_url: `${SITE_URL}/api/checkout/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/cart.html?payment=cancel`
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur Stripe.' });
  }
});

// Stripe success : redirige immédiatement, envoie l'email en arrière-plan
app.get('/api/checkout/stripe/success', async (req, res) => {
  const { session_id } = req.query;
  res.redirect('/cart.html?payment=success');

  if (!session_id || !stripe) return;

  // Email envoyé en arrière-plan (non bloquant)
  (async () => {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status === 'paid') {
        const userEmail = session.metadata?.userEmail || session.customer_email;
        const items = session.metadata?.items ? JSON.parse(session.metadata.items) : [];
        if (userEmail) await sendOrderEmail(userEmail, items);
      }
    } catch (err) {
      console.error('[Stripe success] Erreur :', err.message);
    }
  })();
});

// ── PAYPAL ────────────────────────────────────────────────────────────────────
async function getPaypalToken() {
  const creds = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const resp = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const data = await resp.json();
  return data.access_token;
}

app.post('/api/checkout/paypal', async (req, res) => {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) return res.status(503).json({ error: 'PayPal non configuré.' });
  const { items, userEmail } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Panier vide.' });

  const total = items.reduce((sum, item) => {
    return sum + parseFloat(item.price.replace(',', '.').replace(/[^0-9.]/g, '')) * item.quantity;
  }, 0).toFixed(2);

  try {
    const token = await getPaypalToken();
    const resp = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'EUR', value: total },
          custom_id: userEmail || ''
        }],
        application_context: {
          return_url: `${SITE_URL}/api/checkout/paypal/success`,
          cancel_url: `${SITE_URL}/cart.html?payment=cancel`
        }
      })
    });
    const order = await resp.json();
    // Stocker les infos de commande pour les récupérer au retour PayPal
    pendingPaypalOrders.set(order.id, { userEmail, items });
    const approveLink = order.links.find(l => l.rel === 'approve');
    res.json({ url: approveLink.href });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur PayPal.' });
  }
});

// PayPal success : capture le paiement, envoie l'email, redirige
app.get('/api/checkout/paypal/success', async (req, res) => {
  const { token: orderId } = req.query;
  if (!orderId || !PAYPAL_CLIENT_ID) return res.redirect('/cart.html?payment=success');

  try {
    const accessToken = await getPaypalToken();
    const captureResp = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    });
    const captureData = await captureResp.json();

    if (captureData.status === 'COMPLETED') {
      const pending = pendingPaypalOrders.get(orderId);
      if (pending?.userEmail) {
        await sendOrderEmail(pending.userEmail, pending.items || []);
        pendingPaypalOrders.delete(orderId);
      }
    }
  } catch (err) {
    console.error('[PayPal success] Erreur :', err.message);
  }

  res.redirect('/cart.html?payment=success');
});

// ── PROFIL ────────────────────────────────────────────────────────────────────
app.put('/api/profile', async (req, res) => {
  const { userId, firstName, lastName, email } = req.body;
  if (!userId || !firstName || !lastName || !email)
    return res.status(400).json({ error: 'Champs manquants.' });
  try {
    await pool.query(
      `UPDATE users SET "firstName"=$1, "lastName"=$2, email=$3 WHERE id=$4`,
      [firstName.trim(), lastName.trim(), email.toLowerCase().trim(), userId]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.put('/api/profile/password', async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  if (!userId || !currentPassword || !newPassword)
    return res.status(400).json({ error: 'Champs manquants.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  try {
    const result = await pool.query(`SELECT "passwordHash" FROM users WHERE id=$1`, [userId]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(currentPassword, user.passwordHash))
      return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
    const newHash = bcrypt.hashSync(newPassword, 10);
    await pool.query(`UPDATE users SET "passwordHash"=$1 WHERE id=$2`, [newHash, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.post('/api/resend-carnet', async (req, res) => {
  const { email, slug } = req.body;
  if (!email || !slug) return res.status(400).json({ error: 'Champs manquants.' });
  if (!PRODUCT_FILES[slug]) return res.status(400).json({ error: 'Produit introuvable.' });
  try {
    const product = {
      'brow-beige': "L'Essentiel Brow Beige",
      'brow-gray':  "L'Essentiel Brow Gris",
      'lash-beige': "L'Essentiel Lash Beige",
      'lash-gray':  "L'Essentiel Lash Gris"
    };
    await sendOrderEmail(email, [{ slug, title: product[slug], price: '8,95 €', quantity: 1 }]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur envoi.' });
  }
});

app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint non trouvé' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  console.log(`Admin users: http://localhost:${PORT}/admin/users?token=${ADMIN_TOKEN}`);
});
