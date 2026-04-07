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


// ADD INCOME
router.post("/income", (req, res) => {
    const { date, category, source, amount, description } = req.body;

    const sql = `
        INSERT INTO income (date, category, source, amount, description)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [date, category, source, amount, description], (err, result) => {
        if (err) {
            console.log("Income Insert Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to save income"
            });
        }

        res.json({
            success: true,
            message: "Income added successfully"
        });
    });
});


// ADD EXPENSE
router.post("/expense", (req, res) => {
    const { date, category, title, amount, description } = req.body;

    const sql = `
        INSERT INTO expense (date, category, title, amount, description)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [date, category, title, amount, description], (err, result) => {
        if (err) {
            console.log("Expense Insert Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to save expense"
            });
        }

        res.json({
            success: true,
            message: "Expense added successfully"
        });
    });
});


// GET ALL TRANSACTIONS
router.get("/transactions", (req, res) => {

    const incomeQuery = `
        SELECT 
            id,
            date,
            category,
            source,
            amount,
            description,
            'income' AS type
        FROM income
    `;

    const expenseQuery = `
        SELECT 
            id,
            date,
            category,
            title,
            amount,
            description,
            'expense' AS type
        FROM expense
    `;

    db.query(incomeQuery, (incomeErr, incomeResults) => {

        if (incomeErr) {
            console.log("Income Fetch Error:", incomeErr);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch income"
            });
        }

        db.query(expenseQuery, (expenseErr, expenseResults) => {

            if (expenseErr) {
                console.log("Expense Fetch Error:", expenseErr);
                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch expense"
                });
            }

            const incomeData = incomeResults.map(item => ({
                id: item.id,
                date: item.date,
                category: item.category,
                source: item.source,
                title: "",
                amount: item.amount,
                description: item.description,
                type: "income"
            }));

            const expenseData = expenseResults.map(item => ({
                id: item.id,
                date: item.date,
                category: item.category,
                source: "",
                title: item.title,
                amount: item.amount,
                description: item.description,
                type: "expense"
            }));

            const allTransactions = [...incomeData, ...expenseData];

            allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            res.json({
                success: true,
                transactions: allTransactions
            });
        });
    });
});

module.exports = router;