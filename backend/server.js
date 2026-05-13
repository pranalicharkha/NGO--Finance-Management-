
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const db = require("./config/db");

const app = express();

// Middleware
const corsOptions = {
    origin: function (origin, callback) {
        const allowed = [
            "http://localhost:3000",
            "http://localhost:3001",
            "https://ngo-finance-management-1.onrender.com",
            "https://nidigo-frontend.vercel.app"
        ];
        if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"]
};
app.use(cors(corsOptions));
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "..")));

// Import Routes
const adminRoutes = require("./routes/adminRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const adminProjectRoutes = require("./routes/adminProjectRoutes");
const userAuthRoutes = require("./routes/userAuthRoutes");
const userTransactionRoutes = require("./routes/userTransactionRoutes");
const userProjectRoutes = require("./routes/userProjectRoutes");
const reportRoutes = require("./routes/reportRoutes");
const projectRoutes = require("./routes/projectRoutes");

// Use Routes
app.use("/admin", adminRoutes);
app.use("/admin", adminUserRoutes);
app.use("/admin", adminProjectRoutes);
app.use("/user", userAuthRoutes);
app.use("/user", userTransactionRoutes);
app.use("/user", userProjectRoutes);
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

app.get("/admin-dashboard", (req, res) => {
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
