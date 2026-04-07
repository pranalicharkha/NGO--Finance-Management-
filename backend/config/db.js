const mysql = require("mysql2");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const connection = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "finance_management"
});

connection.connect((err) => {
    if (err) {
        console.log("MySQL Connection Failed:", err.message);
    } else {
        console.log("Connected to MySQL Database");
    }
});

module.exports = connection;
