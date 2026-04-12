const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');

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

// Mapping slug -> fichier PDF produit
const PRODUCT_FILES = {
  'brow-beige': path.join(__dirname, 'files/products/essentiel-brow-beige.pdf'),
  'brow-gray':  path.join(__dirname, 'files/products/essentiel-brow-gris.pdf'),
  'lash-beige': path.join(__dirname, 'files/products/essentiel-lash-beige.pdf'),
  'lash-gray':  path.join(__dirname, 'files/products/essentiel-lash-gris.pdf')
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
}

initDB().then(() => {
  console.log('Base de données initialisée');
}).catch(err => {
  console.error('Erreur init DB:', err);
  process.exit(1);
});

app.use(cors());
app.use(express.json());

// ── EMAIL ─────────────────────────────────────────────────────────────────────
function getMailTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
}

async function sendOrderEmail(toEmail, items) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('[Email] Non configuré — GMAIL_USER ou GMAIL_APP_PASSWORD manquant.');
    return;
  }

  const attachments = [];

  // Guide d'utilisation
  if (fs.existsSync(GUIDE_FILE)) {
    attachments.push({
      filename: 'Guide_Studio_of_Beauty.pdf',
      path: GUIDE_FILE
    });
  } else {
    console.warn('[Email] Guide introuvable :', GUIDE_FILE);
  }

  // Fichiers produits achetés
  const slugsAdded = new Set();
  for (const item of items) {
    const slug = item.slug;
    if (slugsAdded.has(slug)) continue;
    const filePath = PRODUCT_FILES[slug];
    if (filePath && fs.existsSync(filePath)) {
      attachments.push({ filename: `${item.title}.pdf`, path: filePath });
      slugsAdded.add(slug);
    } else {
      console.warn(`[Email] Fichier produit introuvable pour "${slug}" :`, filePath);
    }
  }

  const productListHtml = items.map(i =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #ece9e4;">${i.title}</td><td style="padding:8px 0;border-bottom:1px solid #ece9e4;text-align:right;">x${i.quantity} — ${i.price}</td></tr>`
  ).join('');

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
        Votre carnet digital est joint à cet e-mail, ainsi que le guide d'utilisation.<br>
        Si vous ne voyez pas les pièces jointes, vérifiez vos spams.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${productListHtml}
      </table>
      <p style="margin:28px 0 0;font-size:13px;color:#999;">
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
    await getMailTransporter().sendMail({
      from: `"Studio of Beauty" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: 'Votre commande Studio of Beauty — Carnet digital',
      html,
      attachments
    });
    console.log('[Email] Envoyé à', toEmail);
  } catch (err) {
    console.error('[Email] Erreur envoi :', err.message);
  }
}

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

// ── STRIPE ────────────────────────────────────────────────────────────────────
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

// Stripe success : vérifie le paiement, envoie l'email, redirige
app.get('/api/checkout/stripe/success', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id || !stripe) return res.redirect('/cart.html?payment=success');

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

  res.redirect('/cart.html?payment=success');
});

// ── PAYPAL ────────────────────────────────────────────────────────────────────
async function getPaypalToken() {
  const creds = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const resp = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
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
    const resp = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
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
    const captureResp = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`, {
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
