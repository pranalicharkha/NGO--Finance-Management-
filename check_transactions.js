const Database = require('better-sqlite3');
const db = new Database('database/finance_management.db');

console.log('Income table:');
const income = db.prepare('SELECT * FROM income').all();
console.log(JSON.stringify(income, null, 2));

console.log('\nExpense table:');
const expense = db.prepare('SELECT * FROM expense').all();
console.log(JSON.stringify(expense, null, 2));

console.log('\nProjects table:');
const projects = db.prepare('SELECT * FROM projects').all();
console.log(JSON.stringify(projects, null, 2));

db.close();
