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

router.get("/dashboard", async (req, res) => {
    try {
        const promiseDb = db.promise();
        const year = normalizeYear(req.query.year);

        const [
            [incomeTotalRows],
            [expenseTotalRows],
            [incomeMonthlyRows],
            [expenseMonthlyRows],
            [categoryRows],
            [recentRows]
        ] = await Promise.all([
            promiseDb.query("SELECT COALESCE(SUM(amount), 0) AS totalIncome FROM income"),
            promiseDb.query("SELECT COALESCE(SUM(amount), 0) AS totalExpense FROM expense"),
            promiseDb.query(
                `
                SELECT MONTH(date) AS monthNumber, SUM(amount) AS totalIncome
                FROM income
                WHERE YEAR(date) = ?
                GROUP BY MONTH(date)
                ORDER BY MONTH(date)
                `,
                [year]
            ),
            promiseDb.query(
                `
                SELECT MONTH(date) AS monthNumber, SUM(amount) AS totalExpense
                FROM expense
                WHERE YEAR(date) = ?
                GROUP BY MONTH(date)
                ORDER BY MONTH(date)
                `,
                [year]
            ),
            promiseDb.query(
                `
                SELECT category, SUM(amount) AS totalExpense
                FROM expense
                GROUP BY category
                ORDER BY totalExpense DESC
                `
            ),
            promiseDb.query(
                `
                SELECT *
                FROM (
                    SELECT id, date, category, source, NULL AS title, amount, 'income' AS type
                    FROM income
                    UNION ALL
                    SELECT id, date, category, NULL AS source, title, amount, 'expense' AS type
                    FROM expense
                ) AS transactions
                ORDER BY date DESC, id DESC
                LIMIT 5
                `
            )
        ]);

        const totalIncome = toNumber(incomeTotalRows[0].totalIncome);
        const totalExpense = toNumber(expenseTotalRows[0].totalExpense);
        const monthlySeries = buildMonthlySeries(incomeMonthlyRows, expenseMonthlyRows);

        const monthlyIncome = monthlySeries.map((item) => ({
            month: item.month,
            total: item.income
        }));

        const monthlyExpense = monthlySeries.map((item) => ({
            month: item.month,
            total: item.expense
        }));

        const categoryExpense = categoryRows.map((item) => ({
            category: item.category,
            total: toNumber(item.totalExpense)
        }));

        res.json({
            success: true,
            year,
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            monthlyIncome,
            monthlyExpense,
            categoryExpense,
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

router.get("/monthly-report", async (req, res) => {
    try {
        const promiseDb = db.promise();
        const year = normalizeYear(req.query.year);

        const [[incomeRows], [expenseRows]] = await Promise.all([
            promiseDb.query(
                `
                SELECT MONTH(date) AS monthNumber, SUM(amount) AS totalIncome
                FROM income
                WHERE YEAR(date) = ?
                GROUP BY MONTH(date)
                ORDER BY MONTH(date)
                `,
                [year]
            ),
            promiseDb.query(
                `
                SELECT MONTH(date) AS monthNumber, SUM(amount) AS totalExpense
                FROM expense
                WHERE YEAR(date) = ?
                GROUP BY MONTH(date)
                ORDER BY MONTH(date)
                `,
                [year]
            )
        ]);

        const monthlySeries = buildMonthlySeries(incomeRows, expenseRows);

        res.json({
            success: true,
            year,
            monthlyReport: monthlySeries,
            income: monthlySeries.map((item) => ({
                month: item.month,
                totalIncome: item.income
            })),
            expense: monthlySeries.map((item) => ({
                month: item.month,
                totalExpense: item.expense
            })),
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

router.get("/category-report", async (req, res) => {
    try {
        const promiseDb = db.promise();
        const year = normalizeYear(req.query.year);
        const month = normalizeMonth(req.query.month);

        const params = [year];
        let monthFilterSql = "";

        if (month) {
            monthFilterSql = "AND MONTH(date) = ?";
            params.push(month);
        }

        const [rows] = await promiseDb.query(
            `
            SELECT category, SUM(amount) AS totalExpense
            FROM expense
            WHERE YEAR(date) = ?
            ${monthFilterSql}
            GROUP BY category
            ORDER BY totalExpense DESC
            `,
            params
        );

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
