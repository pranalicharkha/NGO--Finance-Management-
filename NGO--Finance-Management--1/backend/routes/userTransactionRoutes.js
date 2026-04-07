const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.post("/income", (req, res) => {
    const { date, category, source, payment_method = null, amount, description = null } = req.body;

    const sql = `
        INSERT INTO income (date, category, source, payment_method, amount, description)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [date, category, source, payment_method, amount, description], (err, result) => {
        if (err) {
            console.log("Income Insert Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to save income"
            });
        }

        res.json({
            success: true,
            message: "Income added successfully",
            id: result.insertId
        });
    });
});

router.put("/income/:id", (req, res) => {
    const { id } = req.params;
    const { date, category, source, payment_method = null, amount, description = null } = req.body;

    const sql = `
        UPDATE income
        SET date = ?, category = ?, source = ?, payment_method = ?, amount = ?, description = ?
        WHERE id = ?
    `;

    db.query(sql, [date, category, source, payment_method, amount, description, id], (err) => {
        if (err) {
            console.log("Income Update Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to update income"
            });
        }

        res.json({
            success: true,
            message: "Income updated successfully"
        });
    });
});

router.delete("/income/:id", (req, res) => {
    db.query("DELETE FROM income WHERE id = ?", [req.params.id], (err) => {
        if (err) {
            console.log("Income Delete Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to delete income"
            });
        }

        res.json({
            success: true,
            message: "Income deleted successfully"
        });
    });
});

router.post("/expense", (req, res) => {
    const { date, category, title, payment_method = null, amount, description = null } = req.body;

    const sql = `
        INSERT INTO expense (date, category, title, payment_method, amount, description)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [date, category, title, payment_method, amount, description], (err, result) => {
        if (err) {
            console.log("Expense Insert Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to save expense"
            });
        }

        res.json({
            success: true,
            message: "Expense added successfully",
            id: result.insertId
        });
    });
});

router.put("/expense/:id", (req, res) => {
    const { id } = req.params;
    const { date, category, title, payment_method = null, amount, description = null } = req.body;

    const sql = `
        UPDATE expense
        SET date = ?, category = ?, title = ?, payment_method = ?, amount = ?, description = ?
        WHERE id = ?
    `;

    db.query(sql, [date, category, title, payment_method, amount, description, id], (err) => {
        if (err) {
            console.log("Expense Update Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to update expense"
            });
        }

        res.json({
            success: true,
            message: "Expense updated successfully"
        });
    });
});

router.delete("/expense/:id", (req, res) => {
    db.query("DELETE FROM expense WHERE id = ?", [req.params.id], (err) => {
        if (err) {
            console.log("Expense Delete Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to delete expense"
            });
        }

        res.json({
            success: true,
            message: "Expense deleted successfully"
        });
    });
});

router.get("/transactions", async (req, res) => {
    try {
        const promiseDb = db.promise();
        const [incomeResults] = await promiseDb.query(`
            SELECT
                id,
                date,
                category,
                source,
                payment_method,
                amount,
                description,
                'income' AS type
            FROM income
        `);

        const [expenseResults] = await promiseDb.query(`
            SELECT
                id,
                date,
                category,
                title,
                payment_method,
                amount,
                description,
                'expense' AS type
            FROM expense
        `);

        const incomeData = incomeResults.map((item) => ({
            id: item.id,
            recordId: `income-${item.id}`,
            date: item.date,
            category: item.category,
            source: item.source,
            title: "",
            payment_method: item.payment_method,
            amount: Number(item.amount || 0),
            description: item.description,
            type: "income"
        }));

        const expenseData = expenseResults.map((item) => ({
            id: item.id,
            recordId: `expense-${item.id}`,
            date: item.date,
            category: item.category,
            source: "",
            title: item.title,
            payment_method: item.payment_method,
            amount: Number(item.amount || 0),
            description: item.description,
            type: "expense"
        }));

        const transactions = [...incomeData, ...expenseData].sort((a, b) => {
            const dateCompare = new Date(b.date) - new Date(a.date);
            if (dateCompare !== 0) {
                return dateCompare;
            }
            return b.id - a.id;
        });

        res.json({
            success: true,
            transactions
        });
    } catch (error) {
        console.log("Transaction Fetch Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transactions"
        });
    }
});

module.exports = router;
