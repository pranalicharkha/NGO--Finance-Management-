const express = require("express");
const cors = require("cors");
const path = require("path");
const mysql = require("mysql2");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "..")));

// MySQL Database Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "finance_management"
});

db.connect((err) => {
    if (err) {
        console.log("MySQL Connection Failed:", err.message);
    } else {
        console.log("Connected to MySQL Database");
    }
});

// Import Routes
const adminRoutes = require("./routes/adminRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const userTransactionRoutes = require("./routes/userTransactionRoutes");

// Use Routes
app.use("/admin", adminRoutes);
app.use("/admin", adminUserRoutes);
app.use("/user", userTransactionRoutes);

// Login Route
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    const sql = "SELECT * FROM admins WHERE username = ? AND password = ?";

    db.query(sql, [username, password], (err, results) => {
        if (err) {
            console.log("Database Error:", err);
            return res.status(500).json({
                success: false,
                message: "Database error"
            });
        }

        if (results.length > 0) {
            return res.json({
                success: true,
                message: "Login successful"
            });
        } else {
            return res.json({
                success: false,
                message: "Invalid username or password"
            });
        }
    });
});

// Homepage Route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "admin-login.html"));
});

// Dashboard Route
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "dashboard.html"));
});

app.use(["/admin/*path", "/user/*path"], (req, res) => {
    res.status(404).json({
        success: false,
        message: `API route not found: ${req.method} ${req.originalUrl}`
    });
});

app.use((err, req, res, next) => {
    console.log("Unhandled server error:", err);

    if (req.originalUrl.startsWith("/admin") || req.originalUrl.startsWith("/user")) {
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }

    next(err);
});

// Start Server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
