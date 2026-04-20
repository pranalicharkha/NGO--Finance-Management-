
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const db = require("./config/db");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "..")));

// Import Routes
const adminRoutes = require("./routes/adminRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const userAuthRoutes = require("./routes/userAuthRoutes");
const userTransactionRoutes = require("./routes/userTransactionRoutes");
const reportRoutes = require("./routes/reportRoutes");
const projectRoutes = require("./routes/projectRoutes");

// Use Routes
app.use("/admin", adminRoutes);
app.use("/admin", adminUserRoutes);
app.use("/user", userAuthRoutes);
app.use("/user", userTransactionRoutes);
app.use("/user", reportRoutes);
app.use("/user", projectRoutes);

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
