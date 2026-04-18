CREATE DATABASE IF NOT EXISTS finance_management;
USE finance_management;

ALTER TABLE admins
    MODIFY username VARCHAR(100) NOT NULL,
    MODIFY password VARCHAR(255) NOT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email VARCHAR(150) UNIQUE,
    ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'beneficiary',
    ADD COLUMN IF NOT EXISTS status ENUM('active','inactive') DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS donors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donor_name VARCHAR(150) NOT NULL,
    donor_type ENUM('individual','corporate','foundation','government','international') NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(20),
    city VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ngos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ngo_name VARCHAR(150) NOT NULL,
    registration_no VARCHAR(80) UNIQUE,
    location VARCHAR(150),
    contact_email VARCHAR(150),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ngo_id INT NOT NULL,
    project_name VARCHAR(150) NOT NULL,
    project_code VARCHAR(50) UNIQUE,
    focus_area VARCHAR(100),
    description TEXT,
    start_date DATE,
    end_date DATE,
    budget DECIMAL(12,2) DEFAULT 0,
    status ENUM('planned','active','completed','on_hold') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ngo_id) REFERENCES ngos(id)
);

CREATE TABLE IF NOT EXISTS budgets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    budget_year YEAR NOT NULL,
    allocated_amount DECIMAL(12,2) NOT NULL,
    spent_amount DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

ALTER TABLE income
    ADD COLUMN IF NOT EXISTS donor_id INT NULL,
    ADD COLUMN IF NOT EXISTS project_id INT NULL,
    ADD COLUMN IF NOT EXISTS receipt_no VARCHAR(100),
    ADD COLUMN IF NOT EXISTS transaction_mode ENUM('cash','upi','bank_transfer','cheque','card','other') DEFAULT 'bank_transfer',
    ADD COLUMN IF NOT EXISTS status ENUM('pending','received','verified') DEFAULT 'received',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD CONSTRAINT fk_income_donor FOREIGN KEY (donor_id) REFERENCES donors(id),
    ADD CONSTRAINT fk_income_project FOREIGN KEY (project_id) REFERENCES projects(id);

ALTER TABLE expense
    ADD COLUMN IF NOT EXISTS project_id INT NULL,
    ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS receipt_no VARCHAR(100),
    ADD COLUMN IF NOT EXISTS transaction_mode ENUM('cash','upi','bank_transfer','cheque','card','other') DEFAULT 'bank_transfer',
    ADD COLUMN IF NOT EXISTS status ENUM('pending','paid','approved') DEFAULT 'paid',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD CONSTRAINT fk_expense_project FOREIGN KEY (project_id) REFERENCES projects(id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INT NOT NULL,
    performed_by VARCHAR(100),
    action_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_income_date ON income(date);
CREATE INDEX idx_income_category ON income(category);
CREATE INDEX idx_expense_date ON expense(date);
CREATE INDEX idx_expense_category ON expense(category);
CREATE INDEX idx_project_status ON projects(status);
CREATE INDEX idx_donor_type ON donors(donor_type);

INSERT INTO donors (donor_name, donor_type, email, city)
VALUES
('Helping Hands Foundation', 'foundation', 'contact@helpinghands.org', 'Pune'),
('Bright Future CSR', 'corporate', 'csr@brightfuture.com', 'Mumbai');

INSERT INTO ngos (ngo_name, registration_no, location, contact_email, description)
VALUES
('Nidigo Foundation', 'NGO-REG-001', 'Pune', 'contact@nidigo.org', 'Primary NGO profile for community development initiatives.'),
('Hope Rural Trust', 'NGO-REG-002', 'Nashik', 'hello@hoperural.org', 'Partner NGO focused on rural education and healthcare outreach.')
ON DUPLICATE KEY UPDATE ngo_name = VALUES(ngo_name);

INSERT INTO projects (ngo_id, project_name, project_code, focus_area, description, start_date, end_date, budget, status)
SELECT id, 'Women Empowerment Drive', 'NGO-PROJ-001', 'Women Welfare', 'Livelihood and leadership support for women self-help groups.', '2026-04-01', '2026-12-31', 500000.00, 'active'
FROM ngos
WHERE registration_no = 'NGO-REG-001'
ON DUPLICATE KEY UPDATE project_name = VALUES(project_name);

INSERT INTO projects (ngo_id, project_name, project_code, focus_area, description, start_date, end_date, budget, status)
SELECT id, 'Child Education Support', 'NGO-PROJ-002', 'Education', 'School support, books, and mentoring for children in underserved communities.', '2026-04-01', '2027-03-31', 750000.00, 'active'
FROM ngos
WHERE registration_no = 'NGO-REG-002'
ON DUPLICATE KEY UPDATE project_name = VALUES(project_name);
