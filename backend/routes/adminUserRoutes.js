const express = require("express");
const router = express.Router();
const db = require("../config/db");

// =======================
// Add New User
// POST /admin/users
// =======================
router.post("/users", (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            message: "Name, email, and password are required"
        });
    }

    const checkSql = "SELECT id FROM users WHERE email = ?";

    db.query(checkSql, [email], (checkErr, existingUsers) => {
        if (checkErr) {
            console.log(checkErr);
            return res.status(500).json({
                success: false,
                message: "Failed to validate user email"
            });
        }

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";

        db.query(sql, [name, email, password], (err, result) => {
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
});

// =======================
// Get All Users
// GET /admin/users
// =======================
router.get("/users", (req, res) => {
    const sql = "SELECT id, name, email FROM users ORDER BY id DESC";

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
    const { name, email, password } = req.body;

    if (!name || !email) {
        return res.status(400).json({
            success: false,
            message: "User name and email are required"
        });
    }

    const sql = password
        ? "UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?"
        : "UPDATE users SET name = ?, email = ? WHERE id = ?";

    const params = password ? [name, email, password, userId] : [name, email, userId];

    db.query(sql, params, (err) => {
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

    db.query(sql, [userId], (err) => {
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

module.exports = router;
