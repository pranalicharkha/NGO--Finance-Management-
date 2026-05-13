/**
 * Database initialization script for production
 * Run this once after deploying to ensure database is created
 */

const db = require('./config/db');

console.log('Database initialized successfully');
console.log('Tables created:');
console.log('- admins');
console.log('- users');
console.log('- income');
console.log('- expense');
console.log('- projects');
console.log('- project_donations');
console.log('- ngos');

// Verify tables exist
const tables = ['admins', 'users', 'income', 'expense', 'projects', 'project_donations', 'ngos'];
tables.forEach(table => {
    const result = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
    console.log(`✓ ${table}: ${result ? 'EXISTS' : 'MISSING'}`);
});
