const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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

db.close(err => {
  if (err) {
    console.error('Erreur lors de la fermeture de la base de données', err);
    process.exit(1);
  }
  console.log('Base SQLite initialisée dans', dbFile);
});
