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
// USER REGISTRATION
// ===============================

app.post("/register", async (req, res) => {

    try {

        const { name, email, password,phone } = req.body;

        if (!name || !email || !password ||!phone) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const [existingUsers] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query(
    "SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM users"
);

const nextId = result[0].nextId;

await db.query(
    "INSERT INTO users (id, name, email, password, phone) VALUES (?, ?, ?, ?, ?)",
    [nextId, name, email, hashedPassword, phone]
);

        res.json({
            success: true,
            message: "Registration successful"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
}); 
// ===============================
// USER LOGIN
// ===============================

app.post("/user-login", async (req, res) => {

    try {

        const { email, password } = req.body;

        const [users] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
    {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone
    },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({
            success: true,
            token: token,
            name: user.name
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
// USER AUTHENTICATION
// ===============================

function verifyUserToken(req, res, next) {

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

        req.user = decoded;
        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });

    }
}
// ===============================
// USER BOOKINGS
// ===============================

app.get("/user-bookings", verifyUserToken, async (req, res) => {

    try {

        const [bookings] = await db.query(
            "SELECT * FROM bookings WHERE phone = ? ORDER BY id DESC",
            [req.user.phone]
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
// UPDATE BOOKING STATUS
// ===============================

app.put("/bookings/:id/status", verifyAdminToken, async (req, res) => {

    try {

        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = ["Pending", "Accepted", "Completed"];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }

        await db.query(
            "UPDATE bookings SET status = ? WHERE id = ?",
            [status, id]
        );

        res.json({
            success: true,
            message: "Status updated successfully"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not update status"
        });
    }
});
// ===============================
// DELETE BOOKING
// ===============================

app.delete("/bookings/:id", verifyAdminToken, async (req, res) => {

    try {

        const { id } = req.params;

        await db.query(
            "DELETE FROM bookings WHERE id = ?",
            [id]
        );

        res.json({
            success: true,
            message: "Booking deleted successfully"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not delete booking"
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

// GET ALL REGISTERED USERS - ADMIN
app.get("/users", verifyAdminToken, async (req, res) => {
    try {
        const [users] = await db.query(
            "SELECT id, name, email, phone FROM users ORDER BY id DESC"
        );

        res.json({
            success: true,
            users: users
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not load users"
        });
    }
});
// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
