const express = require("express");
const router = express.Router();
const db = require("../config/db");

// =======================
// User Register
// POST /user/register
// =======================
router.post("/register", (req, res) => {
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
            console.log("User Register Check Error:", checkErr);
            return res.status(500).json({
                success: false,
                message: "Failed to validate email"
            });
        }

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";

        db.query(sql, [name, email, password], (err, result) => {
            if (err) {
                console.log("User Register Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to register user"
                });
            }

            res.json({
                success: true,
                message: "User registered successfully",
                userId: result.insertId
            });
        });
    });
});


// =======================
// User Login
// POST /user/login
// =======================
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required"
        });
    }

    const sql = "SELECT id, name, email FROM users WHERE email = ? AND password = ? LIMIT 1";

    db.query(sql, [email, password], (err, results) => {
        if (err) {
            console.log("User Login Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to login user"
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        res.json({
            success: true,
            user: results[0]
        });
    });
});

// =======================
// Change User Password
// PUT /user/change-password
// =======================
router.put("/change-password", (req, res) => {
    const userId = Number(req.body.userId);
    const currentPassword = String(req.body.currentPassword || "").trim();
    const newPassword = String(req.body.newPassword || "").trim();

    if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            message: "User id, current password, and new password are required"
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: "New password must be at least 6 characters long"
        });
    }

    if (currentPassword === newPassword) {
        return res.status(400).json({
            success: false,
            message: "New password must be different from the current password"
        });
    }

    db.query(
        "SELECT id FROM users WHERE id = ? AND password = ? LIMIT 1",
        [userId, currentPassword],
        (checkErr, results) => {
            if (checkErr) {
                console.log("Change Password Check Error:", checkErr);
                return res.status(500).json({
                    success: false,
                    message: "Failed to verify current password"
                });
            }

            if (!results.length) {
                return res.status(401).json({
                    success: false,
                    message: "Current password is incorrect"
                });
            }

            db.query(
                "UPDATE users SET password = ? WHERE id = ?",
                [newPassword, userId],
                (updateErr, updateResult) => {
                    if (updateErr) {
                        console.log("Change Password Update Error:", updateErr);
                        return res.status(500).json({
                            success: false,
                            message: "Failed to change password"
                        });
                    }

                    if (!updateResult.affectedRows) {
                        return res.status(404).json({
                            success: false,
                            message: "User not found"
                        });
                    }

                    res.json({
                        success: true,
                        message: "Password changed successfully"
                    });
                }
            );
        }
    );
});

module.exports = router;
