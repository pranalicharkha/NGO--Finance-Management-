const express = require("express");
const router = express.Router();
const db = require("../config/db");

function cleanText(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

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
                userId: result.lastID || null
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
// Get User Profile
// GET /user/profile/:id
// =======================
router.get("/profile/:id", (req, res) => {
    const userId = Number(req.params.id);

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: "Valid user id is required"
        });
    }

    db.query(
        "SELECT id, name, email, phone, pan_number, address, created_at FROM users WHERE id = ? LIMIT 1",
        [userId],
        (err, results) => {
            if (err) {
                console.log("User Profile Fetch Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to load profile"
                });
            }

            if (!results.length) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            res.json({
                success: true,
                user: results[0]
            });
        }
    );
});

// =======================
// Update User Profile
// PUT /user/profile/:id
// =======================
router.put("/profile/:id", (req, res) => {
    const userId = Number(req.params.id);
    const name = cleanText(req.body.name);
    const email = cleanText(req.body.email);
    const phone = cleanText(req.body.phone);
    const panNumber = cleanText(req.body.pan_number);
    const address = cleanText(req.body.address);

    if (!userId || !name || !email) {
        return res.status(400).json({
            success: false,
            message: "Valid user id, name, and email are required"
        });
    }

    db.query(
        "SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1",
        [email, userId],
        (checkErr, existingUsers) => {
            if (checkErr) {
                console.log("User Profile Email Check Error:", checkErr);
                return res.status(500).json({
                    success: false,
                    message: "Failed to validate email"
                });
            }

            if (existingUsers.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Email already registered with another account"
                });
            }

            db.query(
                "UPDATE users SET name = ?, email = ?, phone = ?, pan_number = ?, address = ? WHERE id = ?",
                [name, email, phone, panNumber, address, userId],
                (updateErr, updateResult) => {
                    if (updateErr) {
                        console.log("User Profile Update Error:", updateErr);
                        return res.status(500).json({
                            success: false,
                            message: "Failed to update profile"
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
                        message: "Profile updated successfully",
                        user: {
                            id: userId,
                            name,
                            email,
                            phone,
                            pan_number: panNumber,
                            address
                        }
                    });
                }
            );
        }
    );
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
