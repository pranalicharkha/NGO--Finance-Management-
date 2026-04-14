CREATE DATABASE IF NOT EXISTS finance_management;
USE finance_management;

-- Admins Table
DROP TABLE IF EXISTS admins;
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50),
    password VARCHAR(50)
);

INSERT INTO admins (username, password) VALUES ('admin', 'admin123');
INSERT INTO admins (username, password) VALUES ('pranali', 'pranali123');
INSERT INTO admins (username, password) VALUES ('janhavi', 'janhavi123');

-- Users Table
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255)
);
INSERT INTO users (name, email, password) VALUES ('User1', 'user1@example.com', 'user123'), ('User2', 'user2@example.com', 'user123');

-- Income Table
DROP TABLE IF EXISTS income;
CREATE TABLE income (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    source VARCHAR(255) NOT NULL,
    payment_method VARCHAR(50),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expense Table
DROP TABLE IF EXISTS expense;
CREATE TABLE expense (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    payment_method VARCHAR(50),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
