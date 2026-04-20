const express = require("express");
const router = express.Router();
const db = require("../config/db");

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function normalizeYear(value) {
    const year = Number(value);
    return Number.isInteger(year) && year > 2000 ? year : new Date().getFullYear();
}

function normalizeMonth(value) {
    if (value === undefined || value === null || value === "") return null;
    const month = Number(value);
    return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

function toNumber(value) {
    return Number(value || 0);
}

function buildMonthlySeries(incomeRows, expenseRows) {
    const incomeMap = new Map(incomeRows.map((item) => [Number(item.monthNumber), toNumber(item.totalIncome)]));
    const expenseMap = new Map(expenseRows.map((item) => [Number(item.monthNumber), toNumber(item.totalExpense)]));

    return MONTH_LABELS.map((month, index) => {
        const monthNumber = index + 1;
        const income = incomeMap.get(monthNumber) || 0;
        const expense = expenseMap.get(monthNumber) || 0;

        return {
            month,
            monthNumber,
            income,
            expense,
            balance: income - expense
        };
    });
}

function recentTransactionTitle(item) {
    return item.type === "income" ? item.source : item.title;
}

router.get("/dashboard", (req, res) => {
    try {
        const year = normalizeYear(req.query.year);
        const userId = Number(req.query.userId);

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        const incomeTotalRow = db.prepare("SELECT IFNULL(SUM(amount), 0) AS totalIncome FROM income WHERE user_id = ?").get(userId);
        const expenseTotalRow = db.prepare("SELECT IFNULL(SUM(amount), 0) AS totalExpense FROM expense WHERE user_id = ?").get(userId);

        const incomeMonthlyRows = db.prepare(`
            SELECT CAST(strftime('%m', date) AS INTEGER) AS monthNumber, SUM(amount) AS totalIncome
            FROM income
            WHERE user_id = ? AND CAST(strftime('%Y', date) AS INTEGER) = ?
            GROUP BY monthNumber
            ORDER BY monthNumber
        `).all(userId, year);

        const expenseMonthlyRows = db.prepare(`
            SELECT CAST(strftime('%m', date) AS INTEGER) AS monthNumber, SUM(amount) AS totalExpense
            FROM expense
            WHERE user_id = ? AND CAST(strftime('%Y', date) AS INTEGER) = ?
            GROUP BY monthNumber
            ORDER BY monthNumber
        `).all(userId, year);

        const categoryRows = db.prepare(`
            SELECT category, SUM(amount) AS totalExpense
            FROM expense
            WHERE user_id = ?
            GROUP BY category
            ORDER BY totalExpense DESC
        `).all(userId);

        const recentRows = db.prepare(`
            SELECT *
            FROM (
                SELECT id, date, category, source, NULL AS title, amount, 'income' AS type
                FROM income
                WHERE user_id = ?
                UNION ALL
                SELECT id, date, category, NULL AS source, title, amount, 'expense' AS type
                FROM expense
                WHERE user_id = ?
            ) AS transactions
            ORDER BY date DESC, id DESC
            LIMIT 5
        `).all(userId, userId);

        const totalIncome = toNumber(incomeTotalRow?.totalIncome);
        const totalExpense = toNumber(expenseTotalRow?.totalExpense);
        const monthlySeries = buildMonthlySeries(incomeMonthlyRows, expenseMonthlyRows);

        res.json({
            success: true,
            year,
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            monthlyIncome: monthlySeries.map((item) => ({ month: item.month, total: item.income })),
            monthlyExpense: monthlySeries.map((item) => ({ month: item.month, total: item.expense })),
            categoryExpense: categoryRows.map((item) => ({
                category: item.category,
                total: toNumber(item.totalExpense)
            })),
            recentTransactions: recentRows.map((item) => ({
                ...item,
                title: recentTransactionTitle(item),
                amount: toNumber(item.amount)
            })),
            chartData: {
                labels: MONTH_LABELS,
                income: monthlySeries.map((item) => item.income),
                expense: monthlySeries.map((item) => item.expense),
                balance: monthlySeries.map((item) => item.balance)
            }
        });
    } catch (error) {
        console.log("User Dashboard Report Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard data"
        });
    }
});

router.get("/monthly-report", (req, res) => {
    try {
        const year = normalizeYear(req.query.year);
        const userId = Number(req.query.userId);

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        const incomeRows = db.prepare(`
            SELECT CAST(strftime('%m', date) AS INTEGER) AS monthNumber, SUM(amount) AS totalIncome
            FROM income
            WHERE user_id = ? AND CAST(strftime('%Y', date) AS INTEGER) = ?
            GROUP BY monthNumber
            ORDER BY monthNumber
        `).all(userId, year);

        const expenseRows = db.prepare(`
            SELECT CAST(strftime('%m', date) AS INTEGER) AS monthNumber, SUM(amount) AS totalExpense
            FROM expense
            WHERE user_id = ? AND CAST(strftime('%Y', date) AS INTEGER) = ?
            GROUP BY monthNumber
            ORDER BY monthNumber
        `).all(userId, year);

        const monthlySeries = buildMonthlySeries(incomeRows, expenseRows);

        res.json({
            success: true,
            year,
            monthlyReport: monthlySeries,
            income: monthlySeries.map((item) => ({ month: item.month, totalIncome: item.income })),
            expense: monthlySeries.map((item) => ({ month: item.month, totalExpense: item.expense })),
            chartData: {
                labels: monthlySeries.map((item) => item.month),
                income: monthlySeries.map((item) => item.income),
                expense: monthlySeries.map((item) => item.expense),
                balance: monthlySeries.map((item) => item.balance)
            }
        });
    } catch (error) {
        console.log("Monthly Report Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch monthly report"
        });
    }
});

router.get("/category-report", (req, res) => {
    try {
        const year = normalizeYear(req.query.year);
        const month = normalizeMonth(req.query.month);
        const userId = Number(req.query.userId);

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        let sql = `
            SELECT category, SUM(amount) AS totalExpense
            FROM expense
            WHERE user_id = ? AND CAST(strftime('%Y', date) AS INTEGER) = ?
        `;
        const params = [userId, year];

        if (month) {
            sql += " AND CAST(strftime('%m', date) AS INTEGER) = ?";
            params.push(month);
        }

        sql += " GROUP BY category ORDER BY totalExpense DESC";

        const rows = db.prepare(sql).all(...params);
        const categories = rows.map((item) => ({
            category: item.category,
            totalExpense: toNumber(item.totalExpense)
        }));

        res.json({
            success: true,
            year,
            month,
            categories,
            chartData: {
                labels: categories.map((item) => item.category),
                values: categories.map((item) => item.totalExpense)
            }
        });
    } catch (error) {
        console.log("Category Report Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch category report"
        });
    }
});

module.exports = router;
