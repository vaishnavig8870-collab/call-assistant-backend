const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();

app.use(cors());
app.use(express.json());

// MySQL connection
const db = process.env.MYSQL_PUBLIC_URL
    ? mysql.createPool(process.env.MYSQL_PUBLIC_URL)
    : null;
// Test MySQL connection
app.get("/db-test", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT 1 AS connected");
        res.json({
            success: true,
            message: "MySQL connected!",
            data: rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "MySQL connection failed"
        });
    }
});

app.get("/", (req, res) => {
    res.send("Call Assistant Backend is Running!");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});