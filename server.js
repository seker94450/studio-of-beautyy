const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'studioofbeauty_admin';

const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, err => {
  if (err) {
    console.error('Impossible d\'ouvrir la base de données', err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
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

app.post('/api/signup', (req, res) => {
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

  const sql = `INSERT INTO users (firstName, lastName, email, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [firstName.trim(), lastName.trim(), normalizedEmail, passwordHash, createdAt], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
      }
      console.error(err);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
    const user = {
      id: this.lastID,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      createdAt
    };
    res.json({ user: serializeUser(user) });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const sql = `SELECT * FROM users WHERE email = ?`;
  db.get(sql, [normalizedEmail], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
    }
    res.json({ user: serializeUser(user) });
  });
});

app.get('/api/users', requireAdmin, (req, res) => {
  db.all(`SELECT id, firstName, lastName, email, createdAt FROM users ORDER BY createdAt DESC`, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }
    res.json({ users: rows });
  });
});

app.get('/admin/users', requireAdmin, (req, res) => {
  db.all(`SELECT id, firstName, lastName, email, createdAt FROM users ORDER BY createdAt DESC`, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur serveur.');
    }

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
    .badge { display: inline-block; padding: 4px 8px; background: #000; color: #fff; border-radius: 4px; font-size: 0.85rem; }
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
  });
});

app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Handle 404 for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint non trouvé' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  console.log(`Admin users: http://localhost:${PORT}/admin/users?token=${ADMIN_TOKEN}`);
});
