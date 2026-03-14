const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from main folder
app.use(express.static(path.join(__dirname, "..")));

// Admin API routes
const adminRoutes = require("./routes/adminRoutes");
app.use("/admin", adminRoutes);

// Default route → login page only for "/"
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "admin-login.html"));
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
const userTransactionRoutes = require("./routes/userTransactionRoutes");
app.use("/user", userTransactionRoutes);