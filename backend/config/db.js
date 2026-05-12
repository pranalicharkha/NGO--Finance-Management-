const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'database', 'finance_management.db');
const db = new Database(dbPath);

function columnExists(tableName, columnName) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some((column) => column.name === columnName);
}

function tableExists(tableName) {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
    return Boolean(row);
}

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
            password TEXT,
            phone TEXT,
            pan_number TEXT,
            address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Income Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS income (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
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
            user_id INTEGER,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            payment_method TEXT,
            amount REAL NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // NGOs Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS ngos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            ngo_name TEXT NOT NULL,
            registration_no TEXT,
            location TEXT,
            contact_email TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Drop old project tables if they exist and recreate with new schema
    db.exec("DROP TABLE IF EXISTS project_donations");
    db.exec("DROP TABLE IF EXISTS projects");

    // Projects Table (Updated for new project management system)
    db.exec(`
        CREATE TABLE projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            target_amount REAL NOT NULL,
            current_amount REAL DEFAULT 0.00,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            image_url TEXT,
            location TEXT,
            beneficiaries_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Project Donations Table
    db.exec(`
        CREATE TABLE project_donations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            user_id INTEGER,
            amount REAL NOT NULL,
            donation_date TEXT NOT NULL,
            donor_name TEXT,
            donor_email TEXT,
            payment_method TEXT,
            message TEXT,
            anonymous INTEGER DEFAULT 0,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    if (!columnExists("projects", "ngo_id")) {
        db.exec("ALTER TABLE projects ADD COLUMN ngo_id INTEGER");
    }

    if (!columnExists("projects", "description")) {
        db.exec("ALTER TABLE projects ADD COLUMN description TEXT");
    }

    if (!columnExists("users", "phone")) {
        db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
    }

    if (!columnExists("users", "pan_number")) {
        db.exec("ALTER TABLE users ADD COLUMN pan_number TEXT");
    }

    if (!columnExists("users", "address")) {
        db.exec("ALTER TABLE users ADD COLUMN address TEXT");
    }

    if (!columnExists("users", "created_at")) {
        db.exec("ALTER TABLE users ADD COLUMN created_at TEXT");
        db.exec("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL");
    }

    if (!columnExists("income", "user_id")) {
        db.exec("ALTER TABLE income ADD COLUMN user_id INTEGER");
    }

    if (!columnExists("income", "project_id")) {
        db.exec("ALTER TABLE income ADD COLUMN project_id INTEGER");
    }

    if (!columnExists("expense", "user_id")) {
        db.exec("ALTER TABLE expense ADD COLUMN user_id INTEGER");
    }

    if (!columnExists("ngos", "user_id")) {
        db.exec("ALTER TABLE ngos ADD COLUMN user_id INTEGER");
    }

    if (!tableExists("ngos")) {
        throw new Error("Failed to initialize ngos table");
    }

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

    // Ensure at least one default NGO exists (single-NGO platform)
    const ngoCount = db.prepare('SELECT COUNT(*) as count FROM ngos').get();
    if (ngoCount.count === 0) {
        db.prepare('INSERT INTO ngos (ngo_name, registration_no, location, contact_email, description) VALUES (?, ?, ?, ?, ?)').run(
            'Nidigo Foundation', null, null, null, 'Default NGO for the platform'
        );
        console.log('Default NGO inserted');
    }

};

initSchema();

// Wrap db.query to match MySQL-style callback interface
db.query = function(sql, params, callback) {
    try {
        if (callback) {
            setImmediate(() => {
                try {
                    const stmt = db.prepare(sql);
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
