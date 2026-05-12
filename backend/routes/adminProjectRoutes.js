const express = require("express");
const router = express.Router();
const db = require("../config/db");

const PROJECT_CATEGORIES = [
    "Education", 
    "Healthcare", 
    "Food Security", 
    "Clean Water", 
    "Infrastructure", 
    "Emergency Relief", 
    "Women Empowerment", 
    "Environmental"
];

const PROJECT_STATUSES = ["active", "completed", "paused", "cancelled"];

function cleanText(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

function normalizeAmount(value) {
    if (value === undefined || value === null || value === "") return 0;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function isValidDate(value) {
    return value === null || /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

// =======================
// Get All Projects
// GET /admin/projects
// =======================
router.get("/projects", (req, res) => {
    const sql = `
        SELECT p.*, 
               (SELECT COUNT(*) FROM project_donations WHERE project_id = p.id) as donation_count,
               (SELECT SUM(amount) FROM project_donations WHERE project_id = p.id) as total_donations
        FROM projects p 
        ORDER BY p.created_at DESC
    `;

    db.query(sql, [], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch projects"
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
// Get Project Statistics
// GET /admin/projects-stats
// =======================
router.get("/projects-stats", (req, res) => {
    const sql = `
        SELECT 
            COUNT(*) as total_projects,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
            COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_projects,
            SUM(target_amount) as total_target_amount,
            SUM(current_amount) as total_current_amount,
            (SELECT COUNT(*) FROM project_donations) as total_donations,
            (SELECT SUM(amount) FROM project_donations) as total_donation_amount
        FROM projects
    `;

    db.query(sql, [], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch project statistics"
            });
        }

        const stats = results[0];
        
        res.json({
            success: true,
            stats: {
                total_projects: Number(stats.total_projects || 0),
                active_projects: Number(stats.active_projects || 0),
                completed_projects: Number(stats.completed_projects || 0),
                paused_projects: Number(stats.paused_projects || 0),
                total_target_amount: Number(stats.total_target_amount || 0),
                total_current_amount: Number(stats.total_current_amount || 0),
                total_donations: Number(stats.total_donations || 0),
                total_donation_amount: Number(stats.total_donation_amount || 0),
                overall_progress_percentage: stats.total_target_amount > 0 ? 
                    ((stats.total_current_amount || 0) / stats.total_target_amount * 100).toFixed(1) : 0
            }
        });
    });
});

// =======================
// Get Single Project
// GET /admin/projects/:id
// =======================
router.get("/projects/:id", (req, res) => {
    const projectId = Number(req.params.id);
    
    const sql = `
        SELECT p.*, 
               (SELECT COUNT(*) FROM project_donations WHERE project_id = p.id) as donation_count,
               (SELECT SUM(amount) FROM project_donations WHERE project_id = p.id) as total_donations
        FROM projects p 
        WHERE p.id = ?
    `;

    db.query(sql, [projectId], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch project"
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        const project = {
            ...results[0],
            target_amount: Number(results[0].target_amount || 0),
            current_amount: Number(results[0].current_amount || 0),
            total_donations: Number(results[0].total_donations || 0),
            progress_percentage: results[0].target_amount > 0 ? 
                ((results[0].total_donations || 0) / results[0].target_amount * 100).toFixed(1) : 0
        };

        res.json({
            success: true,
            project: project
        });
    });
});

// =======================
// Add New Project
// POST /admin/projects
// =======================
router.post("/projects", (req, res) => {
    const {
        name,
        description,
        category,
        target_amount,
        start_date,
        end_date,
        status = "active",
        image_url,
        location,
        beneficiaries_count
    } = req.body;

    // Validation
    if (!name || name.trim().length < 3) {
        return res.status(400).json({
            success: false,
            message: "Project name must be at least 3 characters long"
        });
    }

    if (!PROJECT_CATEGORIES.includes(category)) {
        return res.status(400).json({
            success: false,
            message: "Invalid project category"
        });
    }

    if (!description || description.trim().length < 10) {
        return res.status(400).json({
            success: false,
            message: "Description must be at least 10 characters long"
        });
    }

    if (!target_amount || target_amount <= 0) {
        return res.status(400).json({
            success: false,
            message: "Target amount must be greater than 0"
        });
    }

    if (!start_date || !end_date || !isValidDate(start_date) || !isValidDate(end_date)) {
        return res.status(400).json({
            success: false,
            message: "Valid start date and end date are required"
        });
    }

    if (new Date(end_date) <= new Date(start_date)) {
        return res.status(400).json({
            success: false,
            message: "End date must be after start date"
        });
    }

    if (!PROJECT_STATUSES.includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid project status"
        });
    }

    const sql = `
        INSERT INTO projects 
        (name, description, category, target_amount, start_date, end_date, status, image_url, location, beneficiaries_count) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        cleanText(name),
        cleanText(description),
        category,
        normalizeAmount(target_amount),
        start_date,
        end_date,
        status,
        cleanText(image_url),
        cleanText(location),
        beneficiaries_count ? Number(beneficiaries_count) : 0
    ], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to create project"
            });
        }

        res.status(201).json({
            success: true,
            message: "Project created successfully",
            projectId: result.insertId
        });
    });
});

// =======================
// Update Project
// PUT /admin/projects/:id
// =======================
router.put("/projects/:id", (req, res) => {
    const projectId = Number(req.params.id);
    const {
        name,
        description,
        category,
        target_amount,
        start_date,
        end_date,
        status,
        image_url,
        location,
        beneficiaries_count
    } = req.body;

    // Validation
    if (!name || name.trim().length < 3) {
        return res.status(400).json({
            success: false,
            message: "Project name must be at least 3 characters long"
        });
    }

    if (!PROJECT_CATEGORIES.includes(category)) {
        return res.status(400).json({
            success: false,
            message: "Invalid project category"
        });
    }

    if (!description || description.trim().length < 10) {
        return res.status(400).json({
            success: false,
            message: "Description must be at least 10 characters long"
        });
    }

    if (!target_amount || target_amount <= 0) {
        return res.status(400).json({
            success: false,
            message: "Target amount must be greater than 0"
        });
    }

    if (!start_date || !end_date || !isValidDate(start_date) || !isValidDate(end_date)) {
        return res.status(400).json({
            success: false,
            message: "Valid start date and end date are required"
        });
    }

    if (new Date(end_date) <= new Date(start_date)) {
        return res.status(400).json({
            success: false,
            message: "End date must be after start date"
        });
    }

    if (!PROJECT_STATUSES.includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid project status"
        });
    }

    const sql = `
        UPDATE projects 
        SET name = ?, description = ?, category = ?, target_amount = ?, start_date = ?, end_date = ?, 
            status = ?, image_url = ?, location = ?, beneficiaries_count = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.query(sql, [
        cleanText(name),
        cleanText(description),
        category,
        normalizeAmount(target_amount),
        start_date,
        end_date,
        status,
        cleanText(image_url),
        cleanText(location),
        beneficiaries_count ? Number(beneficiaries_count) : 0,
        projectId
    ], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to update project"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        res.json({
            success: true,
            message: "Project updated successfully"
        });
    });
});

// =======================
// Delete Project
// DELETE /admin/projects/:id
// =======================
router.delete("/projects/:id", (req, res) => {
    const projectId = Number(req.params.id);

    // Check if project has donations
    const checkDonationsSql = "SELECT COUNT(*) as donation_count FROM project_donations WHERE project_id = ?";
    
    db.query(checkDonationsSql, [projectId], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to check project donations"
            });
        }

        if (results[0].donation_count > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete project with existing donations. Consider marking it as completed instead."
            });
        }

        // Delete the project
        const deleteSql = "DELETE FROM projects WHERE id = ?";
        
        db.query(deleteSql, [projectId], (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to delete project"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found"
                });
            }

            res.json({
                success: true,
                message: "Project deleted successfully"
            });
        });
    });
});

// =======================
// Get Project Donations
// GET /admin/projects/:id/donations
// =======================
router.get("/projects/:id/donations", (req, res) => {
    const projectId = Number(req.params.id);

    const sql = `
        SELECT pd.*, u.name as user_name, u.email as user_email
        FROM project_donations pd
        LEFT JOIN users u ON pd.user_id = u.id
        WHERE pd.project_id = ?
        ORDER BY pd.donation_date DESC
    `;

    db.query(sql, [projectId], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch project donations"
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
