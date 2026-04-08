const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET /user/dashboard
router.get("/dashboard", (req, res) => {
    db.query("SELECT SUM(amount) AS totalIncome FROM income", (err, incomeResult) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch income summary"
            });
        }

        db.query("SELECT SUM(amount) AS totalExpense FROM expense", (err, expenseResult) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch expense summary"
                });
            }

            const totalIncome = incomeResult[0].totalIncome || 0;
            const totalExpense = expenseResult[0].totalExpense || 0;
            const balance = totalIncome - totalExpense;

            res.json({
                success: true,
                totalIncome,
                totalExpense,
                balance
            });
        });
    });
});

// GET /user/monthly-report
router.get("/monthly-report", (req, res) => {
    const incomeQuery = `
        SELECT 
            MONTH(date) AS month,
            SUM(amount) AS totalIncome
        FROM income
        GROUP BY MONTH(date)
        ORDER BY MONTH(date)
    `;

    const expenseQuery = `
        SELECT 
            MONTH(date) AS month,
            SUM(amount) AS totalExpense
        FROM expense
        GROUP BY MONTH(date)
        ORDER BY MONTH(date)
    `;

    db.query(incomeQuery, (err, incomeResults) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch monthly income report"
            });
        }

        db.query(expenseQuery, (err, expenseResults) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch monthly expense report"
                });
            }

            res.json({
                success: true,
                income: incomeResults,
                expense: expenseResults
            });
        });
    });
});

// GET /user/category-report
router.get("/category-report", (req, res) => {
    const sql = `
        SELECT 
            category,
            SUM(amount) AS totalExpense
        FROM expense
        GROUP BY category
        ORDER BY totalExpense DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch category report"
            });
        }

        res.json({
            success: true,
            categories: results
        });
    });
});

module.exports = router;
