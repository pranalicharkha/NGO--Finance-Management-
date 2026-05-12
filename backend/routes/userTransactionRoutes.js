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

function buildDonationFilters(query, userId) {
    const clauses = ["i.user_id = ?"];
    const params = [userId];

    if (query.date && isValidDate(query.date)) {
        clauses.push("i.date = ?");
        params.push(String(query.date));
    }

    if (query.dateFrom && isValidDate(query.dateFrom)) {
        clauses.push("i.date >= ?");
        params.push(String(query.dateFrom));
    }

    if (query.dateTo && isValidDate(query.dateTo)) {
        clauses.push("i.date <= ?");
        params.push(String(query.dateTo));
    }

    if (query.category) {
        clauses.push("i.category = ?");
        params.push(String(query.category).trim());
    }

    const projectId = Number(query.projectId || query.project_id);
    if (projectId) {
        clauses.push("i.project_id = ?");
        params.push(projectId);
    }

    const minAmount = Number(query.minAmount || query.amountMin);
    if (Number.isFinite(minAmount) && minAmount > 0) {
        clauses.push("i.amount >= ?");
        params.push(minAmount);
    }

    const maxAmount = Number(query.maxAmount || query.amountMax);
    if (Number.isFinite(maxAmount) && maxAmount > 0) {
        clauses.push("i.amount <= ?");
        params.push(maxAmount);
    }

    const search = cleanText(query.search);
    if (search) {
        clauses.push("(i.source LIKE ? OR i.description LIKE ? OR i.category LIKE ? OR p.project_name LIKE ?)");
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam, searchParam);
    }

    return {
        whereSql: `WHERE ${clauses.join(" AND ")}`,
        params
    };
}

function buildProjectDonationFilters(query) {
    const clauses = [];
    const params = [];

    if (query.date && isValidDate(query.date)) {
        clauses.push("COALESCE(i.date, p.start_date, p.created_at) = ?");
        params.push(String(query.date));
    }

    if (query.dateFrom && isValidDate(query.dateFrom)) {
        clauses.push("COALESCE(i.date, p.start_date, p.created_at) >= ?");
        params.push(String(query.dateFrom));
    }

    if (query.dateTo && isValidDate(query.dateTo)) {
        clauses.push("COALESCE(i.date, p.start_date, p.created_at) <= ?");
        params.push(String(query.dateTo));
    }

    const projectId = Number(query.projectId || query.project_id);
    if (projectId) {
        clauses.push("p.id = ?");
        params.push(projectId);
    }

    const minAmount = Number(query.minAmount || query.amountMin);
    if (Number.isFinite(minAmount) && minAmount > 0) {
        clauses.push("p.budget >= ?");
        params.push(minAmount);
    }

    const maxAmount = Number(query.maxAmount || query.amountMax);
    if (Number.isFinite(maxAmount) && maxAmount > 0) {
        clauses.push("p.budget <= ?");
        params.push(maxAmount);
    }

    return {
        whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
        params
    };
}

router.post("/income", (req, res) => {
    const userId = Number(req.body.userId);
    const date = cleanText(req.body.date);
    const category = cleanText(req.body.category);
    const source = cleanText(req.body.source);
    const paymentMethod = cleanText(req.body.payment_method);
    const description = cleanText(req.body.description);
    const projectId = req.body.project_id ? Number(req.body.project_id) : null;
    const amount = normalizeAmount(req.body.amount);

    if (!userId || !projectId || !isValidDate(date) || !category || !source || !amount) {
        return res.status(400).json({
            success: false,
            message: "User ID, project, date, category, source, and a valid amount are required"
        });
    }

    const project = db.prepare("SELECT id FROM projects WHERE id = ? LIMIT 1").get(projectId);
    if (!project) {
        return res.status(400).json({
            success: false,
            message: "A valid project is required for each donation"
        });
    }

    db.query(
        `
        INSERT INTO income (user_id, date, category, source, payment_method, amount, description, project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [userId, date, category, source, paymentMethod, amount, description, projectId],
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
    const userId = Number(req.body.userId);
    const date = cleanText(req.body.date);
    const category = cleanText(req.body.category);
    const title = cleanText(req.body.title);
    const paymentMethod = cleanText(req.body.payment_method);
    const description = cleanText(req.body.description);
    const amount = normalizeAmount(req.body.amount);

    if (!userId || !isValidDate(date) || !category || !title || !amount) {
        return res.status(400).json({
            success: false,
            message: "User ID, date, category, title, and a valid amount are required"
        });
    }

    db.query(
        `
        INSERT INTO expense (user_id, date, category, title, payment_method, amount, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [userId, date, category, title, paymentMethod, amount, description],
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
    const userId = Number(req.body.userId);
    const date = cleanText(req.body.date);
    const category = cleanText(req.body.category);
    const source = cleanText(req.body.source);
    const paymentMethod = cleanText(req.body.payment_method);
    const description = cleanText(req.body.description);
    const projectId = req.body.project_id ? Number(req.body.project_id) : null;
    const amount = normalizeAmount(req.body.amount);

    if (!incomeId || !userId || !projectId || !isValidDate(date) || !category || !source || !amount) {
        return res.status(400).json({
            success: false,
            message: "Valid income id, user id, project, date, category, source, and amount are required"
        });
    }

    const project = db.prepare("SELECT id FROM projects WHERE id = ? LIMIT 1").get(projectId);
    if (!project) {
        return res.status(400).json({
            success: false,
            message: "A valid project is required for each donation"
        });
    }

    db.query(
        `
        UPDATE income
        SET date = ?, category = ?, source = ?, payment_method = ?, amount = ?, description = ?, project_id = ?
        WHERE id = ? AND user_id = ?
        `,
        [date, category, source, paymentMethod, amount, description, projectId, incomeId, userId],
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
    const userId = Number(req.query.userId);
    if (!incomeId || !userId) {
        return res.status(400).json({
            success: false,
            message: "Valid income id and user id are required"
        });
    }

    db.query("DELETE FROM income WHERE id = ? AND user_id = ?", [incomeId, userId], (err, result) => {
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
    const userId = Number(req.body.userId);
    const date = cleanText(req.body.date);
    const category = cleanText(req.body.category);
    const title = cleanText(req.body.title);
    const paymentMethod = cleanText(req.body.payment_method);
    const description = cleanText(req.body.description);
    const amount = normalizeAmount(req.body.amount);

    if (!expenseId || !userId || !isValidDate(date) || !category || !title || !amount) {
        return res.status(400).json({
            success: false,
            message: "Valid expense id, user id, date, category, title, and amount are required"
        });
    }

    db.query(
        `
        UPDATE expense
        SET date = ?, category = ?, title = ?, payment_method = ?, amount = ?, description = ?
        WHERE id = ? AND user_id = ?
        `,
        [date, category, title, paymentMethod, amount, description, expenseId, userId],
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
    const userId = Number(req.query.userId);
    if (!expenseId || !userId) {
        return res.status(400).json({
            success: false,
            message: "Valid expense id and user id are required"
        });
    }

    db.query("DELETE FROM expense WHERE id = ? AND user_id = ?", [expenseId, userId], (err, result) => {
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
        const userId = Number(req.query.userId);
        const type = cleanText(req.query.type);
        const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : null;

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        const expenseFilters = buildTransactionFilters(req.query);
        const donationFilters = buildDonationFilters(req.query, userId);
        const projectDonationFilters = buildProjectDonationFilters(req.query);
        const useProjectLinkedDonations = String(req.query.projectLinked || "").toLowerCase() === "true";

        expenseFilters.params.unshift(userId);
        const expenseWhere = expenseFilters.whereSql ? expenseFilters.whereSql + " AND user_id = ?" : "WHERE user_id = ?";
        // Fix: user_id param should be at end for AND, or alone for WHERE
        // Let's rebuild properly
        const expenseUserWhere = expenseFilters.whereSql ? expenseFilters.whereSql.replace("WHERE", "WHERE user_id = ? AND") : "WHERE user_id = ?";

        const shouldFetchIncome = !type || type === "income";
        const shouldFetchExpense = !type || type === "expense";

        let incomeResults = [];
        let expenseResults = [];

        if (shouldFetchIncome && useProjectLinkedDonations) {
            const sql = `
                SELECT
                    p.id,
                    COALESCE(MAX(i.date), p.start_date, p.created_at, DATE('now')) AS date,
                    COALESCE(MAX(i.category), 'Donation') AS category,
                    COALESCE(MAX(i.source), 'Project funding') AS source,
                    COALESCE(MAX(i.payment_method), 'bank_transfer') AS payment_method,
                    p.budget AS amount,
                    MAX(i.description) AS description,
                    p.id AS project_id,
                    ? AS user_id,
                    u.name AS donor_name,
                    u.email AS donor_email,
                    p.project_name,
                    p.focus_area AS project_focus_area,
                    p.budget AS project_budget,
                    p.status AS project_status,
                    p.start_date AS project_start_date,
                    p.end_date AS project_end_date
                FROM projects p
                INNER JOIN ngos n ON n.id = p.ngo_id
                INNER JOIN users u ON u.id = ?
                LEFT JOIN income i ON i.project_id = p.id AND i.user_id = ?
                ${projectDonationFilters.whereSql}
                GROUP BY
                    p.id,
                    p.project_name,
                    p.focus_area,
                    p.budget,
                    p.status,
                    p.start_date,
                    p.end_date,
                    p.created_at,
                    u.name,
                    u.email
                ORDER BY COALESCE(MAX(i.date), p.start_date, p.created_at, DATE('now')) DESC, p.id DESC
            `;
            incomeResults = db.prepare(sql).all(userId, userId, userId, ...projectDonationFilters.params);
        } else if (shouldFetchIncome) {
            const sql = `
                SELECT
                    i.id,
                    i.date,
                    i.category,
                    i.source,
                    i.payment_method,
                    i.amount,
                    i.description,
                    i.project_id,
                    i.user_id,
                    u.name AS donor_name,
                    u.email AS donor_email,
                    p.project_name,
                    p.focus_area AS project_focus_area,
                    p.budget AS project_budget,
                    p.status AS project_status,
                    p.start_date AS project_start_date,
                    p.end_date AS project_end_date
                FROM income i
                INNER JOIN users u ON u.id = i.user_id
                INNER JOIN projects p ON p.id = i.project_id
                INNER JOIN ngos n ON n.id = p.ngo_id
                ${donationFilters.whereSql}
            `;
            incomeResults = db.prepare(sql).all(donationFilters.params);
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
                ${expenseUserWhere}
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
                project_id: item.project_id,
                user_id: item.user_id,
                donor_name: item.donor_name,
                donor_email: item.donor_email,
                project_name: item.project_name,
                project_focus_area: item.project_focus_area,
                project_budget: Number(item.project_budget || 0),
                project_status: item.project_status,
                project_start_date: item.project_start_date,
                project_end_date: item.project_end_date,
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
