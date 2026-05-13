const express = require("express");
const router = express.Router();
const db = require("../config/db");

function normalizeProject(project) {
    const normalizedTarget = Number(project.target_amount || project.budget || 0);
    const normalizedTotalDonations = Number(project.total_donations || 0);

    return {
        ...project,
        name: project.name || project.project_name || "Untitled Project",
        project_name: project.project_name || project.name || "Untitled Project",
        category: project.category || project.focus_area || "General",
        focus_area: project.focus_area || project.category || "General",
        target_amount: normalizedTarget,
        budget: Number(project.budget || project.target_amount || 0),
        current_amount: Number(project.current_amount || normalizedTotalDonations || 0),
        total_donations: normalizedTotalDonations,
        payment_status: project.payment_status || "pending",
        progress_percentage: normalizedTarget > 0 ?
            (normalizedTotalDonations / normalizedTarget * 100).toFixed(1) : 0
    };
}

// =======================
// Get Active Projects for Users
// GET /user/projects
// =======================
router.get("/projects", (req, res) => {
    const sql = `
        SELECT p.*, 
               (SELECT COUNT(*) FROM project_donations WHERE project_id = p.id) as donation_count,
               (SELECT SUM(amount) FROM project_donations WHERE project_id = p.id) as total_donations
        FROM projects p 
        WHERE LOWER(COALESCE(p.status, '')) IN ('active', 'planned')
        ORDER BY p.created_at DESC
    `;

    db.query(sql, [], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch active projects"
            });
        }

        const projects = results.map(normalizeProject);

        res.json({
            success: true,
            projects: projects
        });
    });
});

// =======================
// Get Single Project Details
// GET /user/projects/:id
// =======================
router.get("/projects/:id", (req, res) => {
    const projectId = Number(req.params.id);

    const projectSql = `
        SELECT p.*, 
               (SELECT COUNT(*) FROM project_donations WHERE project_id = p.id) as donation_count,
               (SELECT SUM(amount) FROM project_donations WHERE project_id = p.id) as total_donations
        FROM projects p 
        WHERE p.id = ? AND LOWER(COALESCE(p.status, '')) IN ('active', 'planned')
    `;

    db.query(projectSql, [projectId], (err, projectResults) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch project details"
            });
        }

        if (projectResults.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found or not accepting donations"
            });
        }

        const project = normalizeProject(projectResults[0]);

        // Get recent donations for this project
        const donationsSql = `
            SELECT pd.*, u.name as user_name, u.email as user_email
            FROM project_donations pd
            LEFT JOIN users u ON pd.user_id = u.id
            WHERE pd.project_id = ? AND pd.anonymous = FALSE
            ORDER BY pd.donation_date DESC
            LIMIT 10
        `;

        db.query(donationsSql, [projectId], (donationsErr, donationResults) => {
            if (donationsErr) {
                console.log("Failed to fetch donations:", donationsErr);
                donationResults = [];
            }

            const donations = donationResults.map(donation => ({
                ...donation,
                amount: Number(donation.amount || 0)
            }));

            res.json({
                success: true,
                project: project,
                recent_donations: donations
            });
        });
    });
});

// =======================
// Donate to Project
// POST /user/projects/:id/donate
// =======================
router.post("/projects/:id/donate", (req, res) => {
    const projectId = Number(req.params.id);
    const { 
        amount, 
        donor_name, 
        donor_email, 
        payment_method, 
        message, 
        anonymous = false,
        user_id 
    } = req.body;

    // Validation
    if (!projectId || !amount || amount <= 0) {
        return res.status(400).json({
            success: false,
            message: "Project ID and valid donation amount are required"
        });
    }

    if (!donor_name || donor_name.trim().length < 2) {
        return res.status(400).json({
            success: false,
            message: "Donor name must be at least 2 characters long"
        });
    }

    if (!donor_email || !donor_email.includes('@')) {
        return res.status(400).json({
            success: false,
            message: "Valid donor email is required"
        });
    }

    if (!payment_method) {
        return res.status(400).json({
            success: false,
            message: "Payment method is required"
        });
    }

    try {
        const project = db.prepare(`
            SELECT *
            FROM projects
            WHERE id = ? AND LOWER(COALESCE(status, '')) IN ('active', 'planned')
            LIMIT 1
        `).get(projectId);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found or not accepting donations"
            });
        }


        const saveDonation = db.transaction(() => {
            const donationResult = db.prepare(`
                INSERT INTO project_donations
                (project_id, user_id, amount, donation_date, donor_name, donor_email, payment_method, message, anonymous)
                VALUES (?, ?, ?, date('now'), ?, ?, ?, ?, ?)
            `).run(
                projectId,
                user_id || null,
                Number(amount),
                donor_name.trim(),
                donor_email.trim(),
                payment_method,
                message ? message.trim() : null,
                Number(anonymous)
            );

            db.prepare(`
                INSERT INTO income
                (user_id, date, category, source, payment_method, amount, description, project_id)
                VALUES (?, date('now'), ?, ?, ?, ?, ?, ?)
            `).run(
                user_id || null,
                project.focus_area || project.category || "Donation",
                donor_name.trim(),
                payment_method,
                Number(amount),
                message ? message.trim() : null,
                projectId
            );


            db.prepare(`
                UPDATE projects
                SET current_amount = COALESCE((
                    SELECT SUM(pd.amount)
                    FROM project_donations pd
                    WHERE pd.project_id = projects.id
                ), 0)
                WHERE id = ?
            `).run(projectId);

            return donationResult.lastInsertRowid;
        });

        const donationId = saveDonation();

        res.status(201).json({
            success: true,
            message: "Donation processed successfully",
            donationId,
            amount: Number(amount)
        });
    } catch (error) {
        console.log("Donation processing error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process donation"
        });
    }
});

// =======================
// Get User's Donation History
// GET /user/donations
// =======================
router.get("/donations", (req, res) => {
    const userId = Number(req.query.userId);
    
    if (!userId) {
        return res.status(400).json({
            success: false,
            message: "User ID is required"
        });
    }

    const sql = `
        SELECT pd.*, p.name as project_name, p.category as project_category
        FROM project_donations pd
        INNER JOIN projects p ON pd.project_id = p.id
        WHERE pd.user_id = ?
        ORDER BY pd.donation_date DESC
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch donation history"
            });
        }

        const donations = results.map(donation => ({
            ...donation,
            amount: Number(donation.amount || 0)
        }));

        res.json({
            success: true,
            donations: donations
        });
    });
});

router.put("/donations/:id/payment-status", (req, res) => {
    const donationId = Number(req.params.id);
    const userId = Number(req.body.userId);
    const paymentStatus = String(req.body.payment_status || "").trim().toLowerCase();

    if (!donationId || !userId || !["paid", "pending"].includes(paymentStatus)) {
        return res.status(400).json({
            success: false,
            message: "Valid donation id, user id, and payment status are required"
        });
    }

    db.query(
        "UPDATE project_donations SET payment_status = ? WHERE id = ? AND user_id = ?",
        [paymentStatus, donationId, userId],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to update donation payment status"
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({
                    success: false,
                    message: "Donation not found"
                });
            }

            res.json({
                success: true,
                message: "Donation payment status updated successfully"
            });
        }
    );
});

module.exports = router;
