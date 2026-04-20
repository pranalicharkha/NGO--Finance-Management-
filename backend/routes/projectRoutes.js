const express = require("express");
const router = express.Router();
const db = require("../config/db");

const PROJECT_STATUSES = new Set(["planned", "active", "completed", "on_hold"]);

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

function normalizeStatus(value) {
    const status = cleanText(value) || "active";
    return PROJECT_STATUSES.has(status) ? status : null;
}

router.get("/ngos", (req, res) => {
    try {
        const userId = Number(req.query.userId);
        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        const rows = db.prepare(`
            SELECT
                n.id AS ngo_id,
                n.ngo_name,
                n.registration_no,
                n.location,
                n.contact_email,
                n.description AS ngo_description,
                n.created_at,
                p.id AS project_id,
                p.project_name,
                p.project_code,
                p.focus_area,
                p.description AS project_description,
                p.start_date,
                p.end_date,
                p.budget,
                p.status
            FROM ngos n
            LEFT JOIN projects p ON p.ngo_id = n.id
            WHERE n.user_id = ?
            ORDER BY n.ngo_name ASC, p.created_at DESC, p.id DESC
        `).all(userId);

        const ngoMap = new Map();

        rows.forEach((row) => {
            if (!ngoMap.has(row.ngo_id)) {
                ngoMap.set(row.ngo_id, {
                    id: row.ngo_id,
                    ngo_name: row.ngo_name,
                    registration_no: row.registration_no,
                    location: row.location,
                    contact_email: row.contact_email,
                    description: row.ngo_description,
                    created_at: row.created_at,
                    projects: [],
                    totals: {
                        projectCount: 0,
                        totalBudget: 0
                    }
                });
            }

            if (row.project_id) {
                const ngo = ngoMap.get(row.ngo_id);
                const project = {
                    id: row.project_id,
                    ngo_id: row.ngo_id,
                    project_name: row.project_name,
                    project_code: row.project_code,
                    focus_area: row.focus_area,
                    description: row.project_description,
                    start_date: row.start_date,
                    end_date: row.end_date,
                    budget: Number(row.budget || 0),
                    status: row.status
                };
                ngo.projects.push(project);
                ngo.totals.projectCount += 1;
                ngo.totals.totalBudget += project.budget;
            }
        });

        const ngos = Array.from(ngoMap.values());

        res.json({
            success: true,
            ngos,
            summary: {
                ngoCount: ngos.length,
                projectCount: ngos.reduce((sum, item) => sum + item.totals.projectCount, 0),
                totalBudget: ngos.reduce((sum, item) => sum + item.totals.totalBudget, 0)
            }
        });
    } catch (error) {
        console.log("NGO Fetch Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch NGOs and projects"
        });
    }
});

router.post("/ngos", (req, res) => {
    const userId = Number(req.body.userId);
    const ngoName = cleanText(req.body.ngo_name);
    const registrationNo = cleanText(req.body.registration_no);
    const location = cleanText(req.body.location);
    const contactEmail = cleanText(req.body.contact_email);
    const description = cleanText(req.body.description);

    if (!userId || !ngoName) {
        return res.status(400).json({
            success: false,
            message: "User ID and NGO name are required"
        });
    }

    db.query(
        "INSERT INTO ngos (user_id, ngo_name, registration_no, location, contact_email, description) VALUES (?, ?, ?, ?, ?, ?)",
        [userId, ngoName, registrationNo, location, contactEmail, description],
        (err, result) => {
            if (err) {
                console.log("NGO Insert Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to add NGO"
                });
            }

            res.status(201).json({
                success: true,
                message: "NGO added successfully",
                ngoId: result.insertId
            });
        }
    );
});

router.put("/ngos/:id", (req, res) => {
    const ngoId = Number(req.params.id);
    const userId = Number(req.body.userId);
    const ngoName = cleanText(req.body.ngo_name);
    const registrationNo = cleanText(req.body.registration_no);
    const location = cleanText(req.body.location);
    const contactEmail = cleanText(req.body.contact_email);
    const description = cleanText(req.body.description);

    if (!ngoId || !userId || !ngoName) {
        return res.status(400).json({
            success: false,
            message: "Valid NGO id, user id, and NGO name are required"
        });
    }

    db.query(
        "UPDATE ngos SET ngo_name = ?, registration_no = ?, location = ?, contact_email = ?, description = ? WHERE id = ? AND user_id = ?",
        [ngoName, registrationNo, location, contactEmail, description, ngoId, userId],
        (err, result) => {
            if (err) {
                console.log("NGO Update Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to update NGO"
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({
                    success: false,
                    message: "NGO not found"
                });
            }

            res.json({
                success: true,
                message: "NGO updated successfully"
            });
        }
    );
});

router.delete("/ngos/:id", (req, res) => {
    try {
        const ngoId = Number(req.params.id);
        const userId = Number(req.query.userId);
        if (!ngoId || !userId) {
            return res.status(400).json({
                success: false,
                message: "Valid NGO id and user id are required"
            });
        }

        const projectRow = db.prepare("SELECT COUNT(*) AS projectCount FROM projects WHERE ngo_id = ?").get(ngoId);
        if (Number(projectRow?.projectCount || 0) > 0) {
            return res.status(409).json({
                success: false,
                message: "Delete the NGO's projects first, then remove the NGO"
            });
        }

        const result = db.query("DELETE FROM ngos WHERE id = ? AND user_id = ?", [ngoId, userId]);
        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "NGO not found"
            });
        }

        res.json({
            success: true,
            message: "NGO deleted successfully"
        });
    } catch (error) {
        console.log("NGO Delete Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete NGO"
        });
    }
});

router.get("/projects", (req, res) => {
    try {
        const ngoId = Number(req.query.ngoId);
        const whereSql = ngoId ? "WHERE p.ngo_id = ?" : "";
        const params = ngoId ? [ngoId] : [];

        const projects = db.prepare(`
            SELECT
                p.id,
                p.ngo_id,
                n.ngo_name,
                p.project_name,
                p.project_code,
                p.focus_area,
                p.description,
                p.start_date,
                p.end_date,
                p.budget,
                p.status
            FROM projects p
            INNER JOIN ngos n ON n.id = p.ngo_id
            ${whereSql}
            ORDER BY p.created_at DESC, p.id DESC
        `).all(...params);

        res.json({
            success: true,
            projects: projects.map((item) => ({
                ...item,
                budget: Number(item.budget || 0)
            }))
        });
    } catch (error) {
        console.log("Project Fetch Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch projects"
        });
    }
});

router.post("/projects", (req, res) => {
    const ngoId = Number(req.body.ngo_id);
    const projectName = cleanText(req.body.project_name);
    const projectCode = cleanText(req.body.project_code);
    const focusArea = cleanText(req.body.focus_area);
    const description = cleanText(req.body.description);
    const startDate = cleanText(req.body.start_date);
    const endDate = cleanText(req.body.end_date);
    const budget = normalizeAmount(req.body.budget);
    const status = normalizeStatus(req.body.status);

    if (!ngoId || !projectName || budget === null || !status || !isValidDate(startDate) || !isValidDate(endDate)) {
        return res.status(400).json({
            success: false,
            message: "NGO, project name, valid budget, status, and valid dates are required"
        });
    }

    db.query(
        "INSERT INTO projects (ngo_id, project_name, project_code, focus_area, description, start_date, end_date, budget, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [ngoId, projectName, projectCode, focusArea, description, startDate, endDate, budget, status],
        (err, result) => {
            if (err) {
                console.log("Project Insert Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to add project"
                });
            }

            res.status(201).json({
                success: true,
                message: "Project added successfully",
                projectId: result.insertId
            });
        }
    );
});

router.put("/projects/:id", (req, res) => {
    const projectId = Number(req.params.id);
    const ngoId = Number(req.body.ngo_id);
    const projectName = cleanText(req.body.project_name);
    const projectCode = cleanText(req.body.project_code);
    const focusArea = cleanText(req.body.focus_area);
    const description = cleanText(req.body.description);
    const startDate = cleanText(req.body.start_date);
    const endDate = cleanText(req.body.end_date);
    const budget = normalizeAmount(req.body.budget);
    const status = normalizeStatus(req.body.status);

    if (!projectId || !ngoId || !projectName || budget === null || !status || !isValidDate(startDate) || !isValidDate(endDate)) {
        return res.status(400).json({
            success: false,
            message: "Project id, NGO, project name, valid budget, status, and valid dates are required"
        });
    }

    db.query(
        "UPDATE projects SET ngo_id = ?, project_name = ?, project_code = ?, focus_area = ?, description = ?, start_date = ?, end_date = ?, budget = ?, status = ? WHERE id = ?",
        [ngoId, projectName, projectCode, focusArea, description, startDate, endDate, budget, status, projectId],
        (err, result) => {
            if (err) {
                console.log("Project Update Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to update project"
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found"
                });
            }

            res.json({
                success: true,
                message: "Project updated successfully"
            });
        }
    );
});

router.delete("/projects/:id", (req, res) => {
    const projectId = Number(req.params.id);
    if (!projectId) {
        return res.status(400).json({
            success: false,
            message: "Valid project id is required"
        });
    }

    db.query("DELETE FROM projects WHERE id = ?", [projectId], (err, result) => {
        if (err) {
            console.log("Project Delete Error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to delete project"
            });
        }

        if (!result.affectedRows) {
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

module.exports = router;
