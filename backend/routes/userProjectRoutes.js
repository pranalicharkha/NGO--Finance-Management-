const express = require("express");
const router = express.Router();
const db = require("../config/db");

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
        WHERE p.status = 'active'
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

        const projects = results.map(project => ({
            ...project,
            target_amount: Number(project.target_amount || 0),
            current_amount: Number(project.current_amount || 0),
            total_donations: Number(project.total_donations || 0),
            progress_percentage: project.target_amount > 0 ? 
                ((project.total_donations || 0) / project.target_amount * 100).toFixed(1) : 0
        }));

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
        WHERE p.id = ? AND p.status = 'active'
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

        const project = {
            ...projectResults[0],
            target_amount: Number(projectResults[0].target_amount || 0),
            current_amount: Number(projectResults[0].current_amount || 0),
            total_donations: Number(projectResults[0].total_donations || 0),
            progress_percentage: projectResults[0].target_amount > 0 ? 
                ((projectResults[0].total_donations || 0) / projectResults[0].target_amount * 100).toFixed(1) : 0
        };

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

    // Check if project exists and is active
    const checkProjectSql = "SELECT * FROM projects WHERE id = ? AND status = 'active'";
    
    db.query(checkProjectSql, [projectId], (err, projectResults) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to verify project"
            });
        }

        if (projectResults.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found or not accepting donations"
            });
        }

        // Insert donation record
        const donationSql = `
            INSERT INTO project_donations 
            (project_id, user_id, amount, donation_date, donor_name, donor_email, payment_method, message, anonymous) 
            VALUES (?, ?, ?, date('now'), ?, ?, ?, ?, ?)
        `;

        db.query(donationSql, [
            projectId, 
            user_id || null, 
            Number(amount), 
            donor_name.trim(), 
            donor_email.trim(), 
            payment_method, 
            message ? message.trim() : null, 
            anonymous
        ], (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to process donation"
                });
            }

            // Update project's current amount
            const updateProjectSql = "UPDATE projects SET current_amount = current_amount + ? WHERE id = ?";
            
            db.query(updateProjectSql, [Number(amount), projectId], (updateErr) => {
                if (updateErr) {
                    console.log("Failed to update project amount:", updateErr);
                    // Don't fail the response, but log the error
                }
            });

            res.status(201).json({
                success: true,
                message: "Donation processed successfully",
                donationId: result.insertId,
                amount: Number(amount)
            });
        });
    });
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

module.exports = router;
