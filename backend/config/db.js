const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'database', 'finance_management.db');
const db = new Database(dbPath);

// Initialize database schema
const initSchema = () => {
    // Admins Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password TEXT NOT NULL
        )
    `);

    // Users Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            password TEXT
        )
    `);

    // Income Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS income (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            source TEXT NOT NULL,
            payment_method TEXT,
            amount REAL NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Expense Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS expense (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            payment_method TEXT,
            amount REAL NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Projects Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name TEXT NOT NULL,
            project_code TEXT UNIQUE,
            focus_area TEXT,
            description TEXT,
            start_date TEXT,
            end_date TEXT,
            budget REAL DEFAULT 0,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Insert default admins if not exists
    const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get();
    if (adminCount.count === 0) {
        db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', 'admin123');
        db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('pranali', 'pranali123');
        db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('janhavi', 'janhavi123');
        console.log('Default admins inserted');
    }

    // Insert default users if not exists
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
        db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run('User1', 'user1@example.com', 'user123');
        db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run('User2', 'user2@example.com', 'user123');
        console.log('Default users inserted');
    }

    // Insert default projects if not exists
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get();
    if (projectCount.count === 0) {
        db.prepare('INSERT INTO projects (project_name, project_code, focus_area, description, start_date, end_date, budget, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run('Women Empowerment Drive', 'NGO-PROJ-001', 'Women Welfare', 'Livelihood and leadership support for women self-help groups.', '2026-04-01', '2026-12-31', 500000.00, 'active');
        db.prepare('INSERT INTO projects (project_name, project_code, focus_area, description, start_date, end_date, budget, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run('Child Education Support', 'NGO-PROJ-002', 'Education', 'School support, books, and mentoring for children in underserved communities.', '2026-04-01', '2027-03-31', 750000.00, 'active');
        console.log('Default projects inserted');
    }
};

initSchema();

// Wrap db.query to match MySQL interface
const originalQuery = db.query;
db.query = function(sql, params, callback) {
    try {
        if (callback) {
            setImmediate(() => {
                try {
                    const stmt = db.prepare(sql);
                    // Detect if this is an INSERT, UPDATE, or DELETE
                    if (/^\s*(insert|update|delete)/i.test(sql)) {
                        const info = stmt.run(params || []);
                        callback(null, { 
                            insertId: info.lastInsertRowid, 
                            lastID: info.lastInsertRowid, 
                            changes: info.changes, 
                            affectedRows: info.changes 
                        });
                    } else {
                        const results = stmt.all(params || []);
                        callback(null, results);
                    }
                } catch (err) {
                    callback(err, null);
                }
            });
        } else {
            const stmt = db.prepare(sql);
            if (/^\s*(insert|update|delete)/i.test(sql)) {
                return stmt.run(params || []);
            } else {
                return stmt.all(params || []);
            }
        }
    } catch (err) {
        if (callback) {
            setImmediate(() => callback(err, null));
        } else {
            throw err;
        }
    }
};

module.exports = db;
