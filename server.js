const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { Pool } = require('pg');
const Stripe = require('stripe');

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
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/signup', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = bcrypt.hashSync(password, 10);
  const createdAt = new Date().toISOString();

  try {
    const result = await pool.query(
      `INSERT INTO users ("firstName", "lastName", email, "passwordHash", "createdAt") VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [firstName.trim(), lastName.trim(), normalizedEmail, passwordHash, createdAt]
    );
    const user = {
      id: result.rows[0].id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      createdAt
    };
    res.json({ user: serializeUser(user) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  try {
    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [normalizedEmail]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
    }
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
  <p>Accès protégé par token admin.</p>
  <table>
    <thead>
      <tr><th>ID</th><th>Nom</th><th>E-mail</th><th>Date d'inscription</th></tr>
    </thead>
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

// ── STRIPE CHECKOUT ──────────────────────────────────────────────────────────
app.post('/api/checkout/stripe', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe non configuré.' });
  const { items } = req.body;
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
      success_url: `${SITE_URL}/cart.html?payment=success`,
      cancel_url: `${SITE_URL}/cart.html?payment=cancel`
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur Stripe.' });
  }
});

// ── PAYPAL CHECKOUT ───────────────────────────────────────────────────────────
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
  const { items } = req.body;
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
        purchase_units: [{ amount: { currency_code: 'EUR', value: total } }],
        application_context: {
          return_url: `${SITE_URL}/cart.html?payment=success`,
          cancel_url: `${SITE_URL}/cart.html?payment=cancel`
        }
      })
    });
    const order = await resp.json();
    const approveLink = order.links.find(l => l.rel === 'approve');
    res.json({ url: approveLink.href });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur PayPal.' });
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
