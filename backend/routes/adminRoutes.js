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

router.get("/dashboard", async (req, res) => {
    try {
        const promiseDb = db.promise();

        const [
            [incomeTotals],
            [expenseTotals],
            [userTotals],
            [monthlyIncome],
            [monthlyExpense],
            [categoryExpense],
            [paymentMethods],
            [recentTransactions]
        ] = await Promise.all([
            promiseDb.query("SELECT COALESCE(SUM(amount), 0) AS totalIncome FROM income"),
            promiseDb.query("SELECT COALESCE(SUM(amount), 0) AS totalExpense FROM expense"),
            promiseDb.query("SELECT COUNT(*) AS totalUsers FROM users"),
            promiseDb.query(`
                SELECT DATE_FORMAT(date, '%b') AS month, MONTH(date) AS monthNumber, SUM(amount) AS total
                FROM income
                GROUP BY MONTH(date), DATE_FORMAT(date, '%b')
                ORDER BY monthNumber
            `),
            promiseDb.query(`
                SELECT DATE_FORMAT(date, '%b') AS month, MONTH(date) AS monthNumber, SUM(amount) AS total
                FROM expense
                GROUP BY MONTH(date), DATE_FORMAT(date, '%b')
                ORDER BY monthNumber
            `),
            promiseDb.query(`
                SELECT category, SUM(amount) AS total
                FROM expense
                GROUP BY category
                ORDER BY total DESC
            `),
            promiseDb.query(`
                SELECT payment_method AS paymentMethod, SUM(amount) AS total
                FROM (
                    SELECT payment_method, amount FROM income
                    UNION ALL
                    SELECT payment_method, amount FROM expense
                ) AS transactions
                WHERE payment_method IS NOT NULL AND payment_method <> ''
                GROUP BY payment_method
                ORDER BY total DESC
            `),
            promiseDb.query(`
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
            `)
        ]);

        const totalIncome = Number(incomeTotals[0].totalIncome || 0);
        const totalExpense = Number(expenseTotals[0].totalExpense || 0);

        res.json({
            success: true,
            totalIncome,
            totalExpense,
            totalUsers: Number(userTotals[0].totalUsers || 0),
            balance: totalIncome - totalExpense,
            monthlyIncome: monthlyIncome.map((item) => ({
                month: item.month,
                total: Number(item.total || 0)
            })),
            monthlyExpense: monthlyExpense.map((item) => ({
                month: item.month,
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

module.exports = router;
