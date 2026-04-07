const express = require("express");
const router = express.Router();
const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "finance_management"
});

// =======================
// Add New User
// POST /admin/users
// =======================
router.post("/users", (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            message: "User name is required"
        });
    }

    const sql = "INSERT INTO users (name) VALUES (?)";

    db.query(sql, [name], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to add user"
            });
        }

        res.json({
            success: true,
            message: "User added successfully",
            userId: result.insertId
        });
    });
});

// =======================
// Get All Users
// GET /admin/users
// =======================
router.get("/users", (req, res) => {
    const sql = "SELECT * FROM users";

    db.query(sql, (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch users"
            });
        }

        res.json({
            success: true,
            users: results
        });
    });
});

// =======================
// Update User
// PUT /admin/users/:id
// =======================
router.put("/users/:id", (req, res) => {
    const userId = req.params.id;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            message: "User name is required"
        });
    }

    const sql = "UPDATE users SET name = ? WHERE id = ?";

    db.query(sql, [name, userId], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to update user"
            });
        }

        res.json({
            success: true,
            message: "User updated successfully"
        });
    });
});

// =======================
// Delete User
// DELETE /admin/users/:id
// =======================
router.delete("/users/:id", (req, res) => {
    const userId = req.params.id;

    const sql = "DELETE FROM users WHERE id = ?";

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to delete user"
            });
        }

        res.json({
            success: true,
            message: "User deleted successfully"
        });
    });
});

// =======================
// Browser Test Route - Add User
// GET /admin/test-add-user
// =======================
router.get("/test-add-user", (req, res) => {
    const sql = "INSERT INTO users (name) VALUES ('Rahul')";

    db.query(sql, (err, result) => {
        if (err) {
            console.log(err);
            return res.send("Failed to add user");
        }

        res.send("User added successfully");
    });
});

// =======================
// Browser Test Route - Delete User
// GET /admin/delete-user/:id
// =======================
router.get("/delete-user/:id", (req, res) => {
    const userId = req.params.id;

    const sql = "DELETE FROM users WHERE id = ?";

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.log(err);
            return res.send("Failed to delete user");
        }

        res.send("User deleted successfully");
    });
});
router.get("/update-user/:id/:name", (req, res) => {
    const userId = req.params.id;
    const newName = req.params.name;

    const sql = "UPDATE users SET name = ? WHERE id = ?";

    db.query(sql, [newName, userId], (err, result) => {
        if (err) {
            console.log(err);
            return res.send("Failed to update user");
        }

        res.send("User updated successfully");
    });
});
module.exports = router;