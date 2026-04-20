const express = require("express");
const router = express.Router();
const db = require("../config/db");

function cleanText(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

function normalizeAmount(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }
    return amount;
}

function isValidDate(value) {
    return Boolean(value) && /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function buildTransactionFilters(query) {
    const clauses = [];
    const params = [];

    if (query.year) {
        clauses.push("CAST(strftime('%Y', date) AS INTEGER) = ?");
        params.push(Number(query.year));
    }

    if (query.month) {
        clauses.push("CAST(strftime('%m', date) AS INTEGER) = ?");
        params.push(Number(query.month));
    }

    if (query.category) {
        clauses.push("category = ?");
        params.push(String(query.category).trim());
    }

    return {
        whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
        params
    };
}

router.post("/income", (req, res) => {
    const date = cleanText(req.body.date);
    const category = cleanText(req.body.category);
    const source = cleanText(req.body.source);
    const paymentMethod = cleanText(req.body.payment_method);
    const description = cleanText(req.body.description);
    const amount = normalizeAmount(req.body.amount);

    if (!isValidDate(date) || !category || !source || !amount) {
        return res.status(400).json({
            success: false,
            message: "Date, category, source, and a valid amount are required"
        });
    }

    db.query(
        `
        INSERT INTO income (date, category, source, payment_method, amount, description)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [date, category, source, paymentMethod, amount, description],
        (err, result) => {
            if (err) {
                console.log("Income Insert Error:", err);
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
    const date = cleanText(req.body.date);
    const category = cleanText(req.body.category);
    const title = cleanText(req.body.title);
    const paymentMethod = cleanText(req.body.payment_method);
    const description = cleanText(req.body.description);
    const amount = normalizeAmount(req.body.amount);

    if (!isValidDate(date) || !category || !title || !amount) {
        return res.status(400).json({
            success: false,
            message: "Date, category, title, and a valid amount are required"
        });
    }

    db.query(
        `
        INSERT INTO expense (date, category, title, payment_method, amount, description)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [date, category, title, paymentMethod, amount, description],
        (err, result) => {
            if (err) {
                console.log("Expense Insert Error:", err);
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

router.put("/income/:id", (req, res) => {
    const incomeId = Number(req.params.id);
    const date = cleanText(req.body.date);
    const category = cleanText(req.body.category);
    const source = cleanText(req.body.source);
    const paymentMethod = cleanText(req.body.payment_method);
    const description = cleanText(req.body.description);
    const amount = normalizeAmount(req.body.amount);

    if (!incomeId || !isValidDate(date) || !category || !source || !amount) {
        return res.status(400).json({
            success: false,
            message: "Valid income id, date, category, source, and amount are required"
        });
    }

    db.query(
        `
        UPDATE income
        SET date = ?, category = ?, source = ?, payment_method = ?, amount = ?, description = ?
        WHERE id = ?
        `,
        [date, category, source, paymentMethod, amount, description, incomeId],
        (err, result) => {
            if (err) {
                console.log("Income Update Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to update income"
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({
                    success: false,
                    message: "Income record not found"
                });
            }

            res.json({
                success: true,
                message: "Income updated successfully"
            });
        }
    );
});

router.delete("/income/:id", (req, res) => {
    const incomeId = Number(req.params.id);
    if (!incomeId) {
        return res.status(400).json({
            success: false,
            message: "Valid income id is required"
        });
    }

    db.query("DELETE FROM income WHERE id = ?", [incomeId], (err, result) => {
        if (err) {
            console.log("Income Delete Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to delete income"
            });
        }

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Income record not found"
            });
        }

        res.json({
            success: true,
            message: "Income deleted successfully"
        });
    });
});

router.put("/expense/:id", (req, res) => {
    const expenseId = Number(req.params.id);
    const date = cleanText(req.body.date);
    const category = cleanText(req.body.category);
    const title = cleanText(req.body.title);
    const paymentMethod = cleanText(req.body.payment_method);
    const description = cleanText(req.body.description);
    const amount = normalizeAmount(req.body.amount);

    if (!expenseId || !isValidDate(date) || !category || !title || !amount) {
        return res.status(400).json({
            success: false,
            message: "Valid expense id, date, category, title, and amount are required"
        });
    }

    db.query(
        `
        UPDATE expense
        SET date = ?, category = ?, title = ?, payment_method = ?, amount = ?, description = ?
        WHERE id = ?
        `,
        [date, category, title, paymentMethod, amount, description, expenseId],
        (err, result) => {
            if (err) {
                console.log("Expense Update Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to update expense"
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({
                    success: false,
                    message: "Expense record not found"
                });
            }

            res.json({
                success: true,
                message: "Expense updated successfully"
            });
        }
    );
});

router.delete("/expense/:id", (req, res) => {
    const expenseId = Number(req.params.id);
    if (!expenseId) {
        return res.status(400).json({
            success: false,
            message: "Valid expense id is required"
        });
    }

    db.query("DELETE FROM expense WHERE id = ?", [expenseId], (err, result) => {
        if (err) {
            console.log("Expense Delete Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to delete expense"
            });
        }

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Expense record not found"
            });
        }

        res.json({
            success: true,
            message: "Expense deleted successfully"
        });
    });
});

router.get("/transactions", (req, res) => {
    try {
        const type = cleanText(req.query.type);
        const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : null;

        const incomeFilters = buildTransactionFilters(req.query);
        const expenseFilters = buildTransactionFilters(req.query);

        const shouldFetchIncome = !type || type === "income";
        const shouldFetchExpense = !type || type === "expense";

        let incomeResults = [];
        let expenseResults = [];

        if (shouldFetchIncome) {
            const sql = `
                SELECT
                    id,
                    date,
                    category,
                    source,
                    payment_method,
                    amount,
                    description
                FROM income
                ${incomeFilters.whereSql}
            `;
            incomeResults = db.prepare(sql).all(incomeFilters.params);
        }

        if (shouldFetchExpense) {
            const sql = `
                SELECT
                    id,
                    date,
                    category,
                    title,
                    payment_method,
                    amount,
                    description
                FROM expense
                ${expenseFilters.whereSql}
            `;
            expenseResults = db.prepare(sql).all(expenseFilters.params);
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
                type: "income"
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
                type: "expense"
            }))
        ]
            .sort((a, b) => {
                const dateCompare = new Date(b.date) - new Date(a.date);
                if (dateCompare !== 0) return dateCompare;
                return b.id - a.id;
            });

        const limitedTransactions = limit ? transactions.slice(0, limit) : transactions;
        const totalIncome = limitedTransactions
            .filter((item) => item.type === "income")
            .reduce((sum, item) => sum + item.amount, 0);
        const totalExpense = limitedTransactions
            .filter((item) => item.type === "expense")
            .reduce((sum, item) => sum + item.amount, 0);

        res.json({
            success: true,
            count: limitedTransactions.length,
            totals: {
                income: totalIncome,
                expense: totalExpense,
                balance: totalIncome - totalExpense
            },
            transactions: limitedTransactions
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
