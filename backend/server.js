const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

const adminRoutes = require("./routes/adminRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const userTransactionRoutes = require("./routes/userTransactionRoutes");

app.use("/admin", adminRoutes);
app.use("/admin", adminUserRoutes);
app.use("/user", userTransactionRoutes);

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const db = require("./config/db");

    db.query(
        "SELECT * FROM admins WHERE username = ? AND password = ?",
        [username, password],
        (err, results) => {
            if (err) {
                console.log("Database Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Database error"
                });
            }

            if (!results.length) {
                return res.json({
                    success: false,
                    message: "Invalid username or password"
                });
            }

            res.json({
                success: true,
                message: "Login successful"
            });
        }
    );
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "admin-login.html"));
});

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
