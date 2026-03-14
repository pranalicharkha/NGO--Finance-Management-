const express = require("express");
const router = express.Router();
const db = require("../config/db");


// ======================
// Add Income API
// POST /user/income
// ======================
router.post("/income", (req, res) => {

    const { date, category, source, amount, description } = req.body;

    const sql = `
        INSERT INTO income (date, category, source, amount, description)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [date, category, source, amount, description], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ success: false });
        }

        res.json({
            success: true,
            message: "Income added successfully"
        });
    });
});


// ======================
// Add Expense API
// POST /user/expense
// ======================
router.post("/expense", (req, res) => {

    const { date, category, title, amount, description } = req.body;

    const sql = `
        INSERT INTO expense (date, category, title, amount, description)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [date, category, title, amount, description], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ success: false });
        }

        res.json({
            success: true,
            message: "Expense added successfully"
        });
    });
});

module.exports = router;