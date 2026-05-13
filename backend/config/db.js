const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

let dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "..", "database", "finance_management.db");
try {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
} catch (err) {
    console.warn("Could not use DATABASE_PATH, falling back to local path:", err.message);
    dbPath = path.join(__dirname, "..", "..", "database", "finance_management.db");
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
}
const db = new Database(dbPath);

function columnExists(tableName, columnName) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some((column) => column.name === columnName);
}

function tableExists(tableName) {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
    return Boolean(row);
}

const initSchema = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password TEXT NOT NULL
        )
    `);

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

    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
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

    db.exec(`
        CREATE TABLE IF NOT EXISTS project_donations (
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

    const projectColumnDefinitions = {
        created_by_admin: "INTEGER DEFAULT 0",
        ngo_id: "INTEGER",
        project_name: "TEXT",
        project_code: "TEXT",
        focus_area: "TEXT",
        budget: "REAL DEFAULT 0",
        payment_method: "TEXT",
        payment_status: "TEXT DEFAULT 'paid'",
        name: "TEXT",
        description: "TEXT",
        category: "TEXT",
        target_amount: "REAL DEFAULT 0",
        current_amount: "REAL DEFAULT 0",
        start_date: "TEXT",
        end_date: "TEXT",
        status: "TEXT DEFAULT 'active'",
        image_url: "TEXT",
        location: "TEXT",
        beneficiaries_count: "INTEGER DEFAULT 0",
        created_at: "TEXT",
        updated_at: "TEXT"
    };

    Object.entries(projectColumnDefinitions).forEach(([columnName, definition]) => {
        try {
            if (!columnExists("projects", columnName)) {
                db.exec(`ALTER TABLE projects ADD COLUMN ${columnName} ${definition}`);
            }
        } catch (error) {
            if (!String(error.message || "").includes("duplicate column name")) {
                throw error;
            }
        }
    });

    db.exec(`
        UPDATE projects
        SET
            created_by_admin = COALESCE(created_by_admin, 0),
            name = COALESCE(NULLIF(name, ''), project_name, 'Untitled Project'),
            project_name = COALESCE(NULLIF(project_name, ''), name, 'Untitled Project'),
            category = COALESCE(NULLIF(category, ''), focus_area, 'General'),
            focus_area = COALESCE(NULLIF(focus_area, ''), category, 'General'),
            target_amount = COALESCE(NULLIF(target_amount, 0), budget, 0),
            budget = COALESCE(NULLIF(budget, 0), target_amount, 0),
            current_amount = COALESCE(current_amount, CASE WHEN payment_status = 'paid' THEN COALESCE(budget, target_amount, 0) ELSE 0 END),
            payment_status = COALESCE(NULLIF(payment_status, ''), 'paid'),
            status = COALESCE(NULLIF(status, ''), 'active')
    `);

    if (!columnExists("project_donations", "payment_status")) {
        db.exec("ALTER TABLE project_donations ADD COLUMN payment_status TEXT DEFAULT 'pending'");
    }

    if (!columnExists("income", "user_id")) {
        db.exec("ALTER TABLE income ADD COLUMN user_id INTEGER");
    }

    if (!columnExists("income", "project_id")) {
        db.exec("ALTER TABLE income ADD COLUMN project_id INTEGER");
    }

    db.exec(`
        UPDATE project_donations
        SET payment_status = COALESCE(NULLIF(payment_status, ''), 'pending')
    `);

    db.exec(`
        INSERT INTO project_donations (
            project_id,
            user_id,
            amount,
            donation_date,
            donor_name,
            donor_email,
            payment_method,
            message,
            anonymous
        )
        SELECT
            i.project_id,
            i.user_id,
            i.amount,
            COALESCE(i.date, DATE('now')),
            u.name,
            u.email,
            i.payment_method,
            i.description,
            0
        FROM income i
        INNER JOIN projects existing_project ON existing_project.id = i.project_id
        LEFT JOIN users u ON u.id = i.user_id
        WHERE i.project_id IS NOT NULL
          AND i.amount IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM project_donations pd
              WHERE pd.project_id = i.project_id
                AND COALESCE(pd.user_id, -1) = COALESCE(i.user_id, -1)
                AND pd.amount = i.amount
                AND pd.donation_date = COALESCE(i.date, DATE('now'))
          )
    `);

    db.exec(`
        UPDATE projects
        SET current_amount = COALESCE((
            SELECT SUM(pd.amount)
            FROM project_donations pd
            WHERE pd.project_id = projects.id
        ), 0)
    `);

    db.exec(`
        INSERT INTO income (
            user_id,
            date,
            category,
            source,
            payment_method,
            amount,
            description,
            project_id
        )
        SELECT
            pd.user_id,
            pd.donation_date,
            COALESCE(NULLIF(p.focus_area, ''), NULLIF(p.category, ''), 'Donation'),
            COALESCE(NULLIF(pd.donor_name, ''), NULLIF(p.project_name, ''), NULLIF(p.name, ''), 'Project Donation'),
            COALESCE(NULLIF(pd.payment_method, ''), NULLIF(p.payment_method, ''), 'bank_transfer'),
            pd.amount,
            pd.message,
            pd.project_id
        FROM project_donations pd
        INNER JOIN projects p ON p.id = pd.project_id
        WHERE pd.amount IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM income i
              WHERE COALESCE(i.project_id, -1) = COALESCE(pd.project_id, -1)
                AND COALESCE(i.user_id, -1) = COALESCE(pd.user_id, -1)
                AND i.amount = pd.amount
                AND i.date = pd.donation_date
          )
    `);

    db.exec("UPDATE projects SET location = NULL WHERE TRIM(COALESCE(location, '')) IN ('0.0', '0', '')");

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

    if (!columnExists("expense", "user_id")) {
        db.exec("ALTER TABLE expense ADD COLUMN user_id INTEGER");
    }

    if (!columnExists("ngos", "user_id")) {
        db.exec("ALTER TABLE ngos ADD COLUMN user_id INTEGER");
    }

    if (!tableExists("ngos")) {
        throw new Error("Failed to initialize ngos table");
    }

    const adminCount = db.prepare("SELECT COUNT(*) as count FROM admins").get();
    if (adminCount.count === 0) {
        db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)").run("admin", "admin123");
        db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)").run("pranali", "pranali123");
        db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)").run("janhavi", "janhavi123");
        console.log("Default admins inserted");
    }

    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
    if (userCount.count === 0) {
        db.prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)").run("User1", "user1@example.com", "user123");
        db.prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)").run("User2", "user2@example.com", "user123");
        console.log("Default users inserted");
    }

    const ngoCount = db.prepare("SELECT COUNT(*) as count FROM ngos").get();
    if (ngoCount.count === 0) {
        db.prepare("INSERT INTO ngos (ngo_name, registration_no, location, contact_email, description) VALUES (?, ?, ?, ?, ?)").run(
            "Nidigo Foundation",
            null,
            null,
            null,
            "Default NGO for the platform"
        );
        console.log("Default NGO inserted");
    }
};

initSchema();

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
            }
            return stmt.all(params || []);
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
