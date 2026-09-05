const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();

app.use(cors());
app.use(express.json());

// ===============================
// MYSQL CONNECTION
// ===============================

const db = process.env.MYSQL_PUBLIC_URL
    ? mysql.createPool(process.env.MYSQL_PUBLIC_URL)
    : null;

// ===============================
// ADMIN LOGIN
// ===============================

app.post("/admin-login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const [admins] = await db.query(
            "SELECT * FROM admins WHERE username = ?",
            [username]
        );

        if (admins.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const admin = admins[0];

        const passwordMatch = await bcrypt.compare(
            password,
            admin.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({
            success: true,
            token: token
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
});
// ===============================
// BOOKING
// ===============================

app.post("/bookings", async (req, res) => {
    try {

        const {
            name,
            phone,
            service,
            date,
            location,
            request
        } = req.body;

        // Get next ID
        const [result] = await db.query(
            "SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM bookings"
        );

        const nextId = result[0].nextId;

        // Insert booking
        const sql = `
            INSERT INTO bookings
            (id, name, phone, service, date, location, request)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(sql, [
            nextId,
            name,
            phone,
            service,
            date,
            location,
            request
        ]);

        res.json({
            success: true,
            message: "Booking saved successfully!"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Booking could not be saved"
        });
    }
});

// ===============================
// ADMIN AUTHENTICATION
// ===============================

function verifyAdminToken(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    const token = authHeader.split(" ")[1];

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.admin = decoded;
        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}


// ===============================
// GET ALL BOOKINGS
// ===============================

app.get("/bookings", verifyAdminToken, async (req, res) => {

    try {

        const [bookings] = await db.query(
            "SELECT * FROM bookings ORDER BY id DESC"
        );

        res.json({
            success: true,
            bookings: bookings
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not load bookings"
        });
    }
});
// ===============================
// TEST MYSQL CONNECTION
// ===============================

app.get("/db-test", async (req, res) => {
    try {

        const [rows] = await db.query(
            "SELECT 1 AS connected"
        );

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


// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
    res.send("Call Assistant Backend is Running!");
});


// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});