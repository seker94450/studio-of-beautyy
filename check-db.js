const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, err => {
  if (err) {
    console.error('Erreur ouverture base:', err);
    process.exit(1);
  }
});

console.log('=== TABLES ===');
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
  if (err) {
    console.error('Erreur:', err);
    return;
  }
  rows.forEach(row => console.log('- ' + row.name));

  console.log('\n=== USERS ===');
  db.all("SELECT id, firstName, lastName, email, createdAt FROM users LIMIT 5", [], (err, users) => {
    if (err) {
      console.error('Erreur:', err);
    } else {
      console.log(`${users.length} utilisateurs trouvés`);
      users.forEach(user => {
        console.log(`- ${user.id}: ${user.firstName} ${user.lastName} (${user.email})`);
      });
    }

    console.log('\n=== ORDERS ===');
    db.all("SELECT id, userId, total, createdAt FROM orders LIMIT 5", [], (err, orders) => {
      if (err) {
        console.error('Erreur:', err);
      } else {
        console.log(`${orders.length} commandes trouvées`);
      }
      db.close();
    });
  });
});