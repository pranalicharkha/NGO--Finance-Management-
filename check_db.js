const Database = require('better-sqlite3');
const db = new Database('database/finance_management.db');

console.log('Tables in database:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(JSON.stringify(tables, null, 2));

if (tables.length > 0) {
  console.log('\nFirst table data:');
  const firstTable = tables[0].name;
  const data = db.prepare(`SELECT * FROM ${firstTable}`).all();
  console.log(JSON.stringify(data, null, 2));
}

db.close();
