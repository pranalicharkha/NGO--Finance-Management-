const express = require("express");
const router = express.Router();
const db = require("../config/db");


// ==============================
// Admin Login API
// POST /admin/login
// ==============================
router.post("/login", (req, res) => {

    const { username, password } = req.body;

    const sql = "SELECT * FROM admins WHERE username=? AND password=?";

    db.query(sql, [username, password], (err, result) => {

        if (err) {
            console.log(err);
            return res.status(500).json({ success:false });
        }

        if (result.length > 0) {

            res.json({
                success: true,
                username: result[0].username
            });

        } else {

            res.json({
                success: false,
                message: "Invalid username or password"
            });

        }

    });

});



// ==============================
// Dashboard Summary API
// GET /admin/dashboard
// ==============================
router.get("/dashboard", (req, res) => {

    const dashboardData = {};

    // Total Income
    db.query("SELECT SUM(amount) AS totalIncome FROM income", (err, incomeResult) => {

        if (err) return res.status(500).json(err);

        dashboardData.totalIncome = incomeResult[0].totalIncome || 0;

        // Total Expense
        db.query("SELECT SUM(amount) AS totalExpense FROM expense", (err, expenseResult) => {

            if (err) return res.status(500).json(err);

            dashboardData.totalExpense = expenseResult[0].totalExpense || 0;

            // Total Users
            db.query("SELECT COUNT(*) AS totalUsers FROM users", (err, userResult) => {

                if (err) return res.status(500).json(err);

                dashboardData.totalUsers = userResult[0].totalUsers;

                // Balance
                dashboardData.balance =
                    dashboardData.totalIncome - dashboardData.totalExpense;

                res.json(dashboardData);

            });

        });

    });

});


module.exports = router;