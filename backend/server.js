const express = require("express");
const cors = require("cors");
const path = require("path");
const mysql = require("mysql2");
require("dotenv").config();

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
const userAuthRoutes = require("./routes/userAuthRoutes");
const userTransactionRoutes = require("./routes/userTransactionRoutes");
const reportRoutes = require("./routes/reportRoutes");

// Use Routes
app.use("/admin", adminRoutes);
app.use("/admin", adminUserRoutes);
app.use("/user", userAuthRoutes);
app.use("/user", userTransactionRoutes);
app.use("/user", reportRoutes);

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

// Landing and role entry routes
// Landing and role entry routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "admin-login.html"));
});

app.get("/admin/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "dashboard.html"));
});

app.get("/user", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "user-login.html"));
});

app.get("/user/dashboard-page", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "user-dashboard.html"));
});


// Start Server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
