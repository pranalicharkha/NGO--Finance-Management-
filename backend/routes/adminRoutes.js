const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.query(
        "SELECT * FROM admins WHERE username = ? AND password = ?",
        [username, password],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ success: false, message: "Database error" });
            }

            if (!result.length) {
                return res.json({
                    success: false,
                    message: "Invalid username or password"
                });
            }

            res.json({
                success: true,
                username: result[0].username
            });
        }
    );
});

router.post("/income", (req, res) => {
    const date = req.body.date;
    const category = req.body.category;
    const source = req.body.source;
    const paymentMethod = req.body.payment_method;
    const description = req.body.description;
    const amount = Number(req.body.amount);

    if (!date || !category || !source || !amount) {
        return res.status(400).json({
            success: false,
            message: "Date, category, source, and amount are required"
        });
    }

    db.query(
        `INSERT INTO income (date, category, source, payment_method, amount, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [date, category, source, paymentMethod, amount, description],
        (err, result) => {
            if (err) {
                console.log("Admin Income Insert Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to save income"
                });
            }

            res.status(201).json({
                success: true,
                message: "Income added successfully",
                incomeId: result.insertId
            });
        }
    );
});

router.post("/expense", (req, res) => {
    const date = req.body.date;
    const category = req.body.category;
    const title = req.body.title;
    const paymentMethod = req.body.payment_method;
    const description = req.body.description;
    const amount = Number(req.body.amount);

    if (!date || !category || !title || !amount) {
        return res.status(400).json({
            success: false,
            message: "Date, category, title, and amount are required"
        });
    }

    db.query(
        `INSERT INTO expense (date, category, title, payment_method, amount, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [date, category, title, paymentMethod, amount, description],
        (err, result) => {
            if (err) {
                console.log("Admin Expense Insert Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to save expense"
                });
            }

            res.status(201).json({
                success: true,
                message: "Expense added successfully",
                expenseId: result.insertId
            });
        }
    );
});

router.get("/dashboard", (req, res) => {
    try {
        // SQLite-compatible queries
        const incomeTotal = db.prepare("SELECT IFNULL(SUM(amount), 0) AS totalIncome FROM income").get();
        const expenseTotal = db.prepare("SELECT IFNULL(SUM(amount), 0) AS totalExpense FROM expense").get();
        const userTotal = db.prepare("SELECT COUNT(*) AS totalUsers FROM users").get();
        
        // Monthly income - SQLite compatible
        const monthlyIncome = db.prepare(`
            SELECT CAST(strftime('%m', date) AS INTEGER) AS monthNumber, SUM(amount) AS total
            FROM income
            GROUP BY monthNumber
            ORDER BY monthNumber
        `).all();
        
        // Monthly expense - SQLite compatible
        const monthlyExpense = db.prepare(`
            SELECT CAST(strftime('%m', date) AS INTEGER) AS monthNumber, SUM(amount) AS total
            FROM expense
            GROUP BY monthNumber
            ORDER BY monthNumber
        `).all();
        
        // Category expense - SQLite compatible
        const categoryExpense = db.prepare(`
            SELECT category, SUM(amount) AS total
            FROM expense
            GROUP BY category
            ORDER BY total DESC
        `).all();
        
        // Payment methods - SQLite compatible
        const paymentMethods = db.prepare(`
            SELECT payment_method AS paymentMethod, SUM(amount) AS total
            FROM (
                SELECT payment_method, amount FROM income
                UNION ALL
                SELECT payment_method, amount FROM expense
            ) AS transactions
            WHERE payment_method IS NOT NULL AND payment_method <> ''
            GROUP BY payment_method
            ORDER BY total DESC
        `).all();
        
        // Recent transactions - SQLite compatible
        const recentTransactions = db.prepare(`
            SELECT *
            FROM (
                SELECT id, date, category, source AS title, amount, 'income' AS type
                FROM income
                UNION ALL
                SELECT id, date, category, title, amount, 'expense' AS type
                FROM expense
            ) AS transactions
            ORDER BY date DESC, id DESC
            LIMIT 5
        `).all();

        const totalIncome = Number(incomeTotal.totalIncome || 0);
        const totalExpense = Number(expenseTotal.totalExpense || 0);
        
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        res.json({
            success: true,
            totalIncome,
            totalExpense,
            totalUsers: Number(userTotal.totalUsers || 0),
            balance: totalIncome - totalExpense,
            monthlyIncome: monthlyIncome.map((item) => ({
                month: monthNames[item.monthNumber - 1] || "Unknown",
                total: Number(item.total || 0)
            })),
            monthlyExpense: monthlyExpense.map((item) => ({
                month: monthNames[item.monthNumber - 1] || "Unknown",
                total: Number(item.total || 0)
            })),
            categoryExpense: categoryExpense.map((item) => ({
                category: item.category,
                total: Number(item.total || 0)
            })),
            paymentMethods: paymentMethods.map((item) => ({
                paymentMethod: item.paymentMethod,
                total: Number(item.total || 0)
            })),
            recentTransactions: recentTransactions.map((item) => ({
                ...item,
                amount: Number(item.amount || 0)
            }))
        });
    } catch (error) {
        console.log("Dashboard API error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load dashboard data"
        });
    }
});

router.get("/transactions", (req, res) => {
    try {
        const type = req.query.type;
        const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : null;

        const shouldFetchIncome = !type || type === "income";
        const shouldFetchExpense = !type || type === "expense";

        let incomeResults = [];
        let expenseResults = [];

        if (shouldFetchIncome) {
            const sql = `
                SELECT
                    id, date, category, source, payment_method, amount, description, user_id
                FROM income
            `;
            incomeResults = db.prepare(sql).all();
        }

        if (shouldFetchExpense) {
            const sql = `
                SELECT
                    id, date, category, title, payment_method, amount, description, user_id
                FROM expense
            `;
            expenseResults = db.prepare(sql).all();
        }

        const transactions = [
            ...incomeResults.map((item) => ({
                id: item.id,
                date: item.date,
                category: item.category,
                title: item.source,
                source: item.source,
                payment_method: item.payment_method,
                amount: Number(item.amount || 0),
                description: item.description,
                type: "income",
                userId: item.user_id
            })),
            ...expenseResults.map((item) => ({
                id: item.id,
                date: item.date,
                category: item.category,
                title: item.title,
                source: "",
                payment_method: item.payment_method,
                amount: Number(item.amount || 0),
                description: item.description,
                type: "expense",
                userId: item.user_id
            }))
        ].sort((a, b) => {
            const dateCompare = new Date(b.date) - new Date(a.date);
            if (dateCompare !== 0) return dateCompare;
            return b.id - a.id;
        });

        const limitedTransactions = limit ? transactions.slice(0, limit) : transactions;

        res.json({
            success: true,
            transactions: limitedTransactions
        });
    } catch (error) {
        console.log("Admin Transaction Fetch Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transactions"
        });
    }
});

module.exports = router;
