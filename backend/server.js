// ================= SAFE IMPORTS =================
let express, mongoose;

try {
    express = require("express");
    mongoose = require("mongoose");
} catch (err) {
    console.log("❌ Required modules not installed!");
    console.log("👉 Run: npm install express mongoose");
    process.exit(1);
}

const app = express();
app.use(express.json());

// ================= DATABASE CONNECTION =================
mongoose.connect("mongodb://127.0.0.1:27017/financeDB")
.then(() => console.log("✅ Database Connected"))
.catch(err => console.log("❌ DB Error:", err.message));

// ================= USER MODEL =================
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    }
});

const User = mongoose.model("User", userSchema);

// ================= ROUTES =================

// ✅ Default route (to check server)
app.get("/", (req, res) => {
    res.send("🚀 Admin User Management API Running");
});

// ✅ POST → Add User
app.post("/admin/users", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const newUser = new User({ name, email, password });
        await newUser.save();

        res.status(201).json({
            message: "User added successfully",
            data: newUser
        });

    } catch (error) {
        res.status(500).json({
            message: "Error adding user",
            error: error.message
        });
    }
});

// ✅ GET → View Users
app.get("/admin/users", async (req, res) => {
    try {
        const users = await User.find();

        res.json({
            message: "Users fetched",
            count: users.length,
            data: users
        });

    } catch (error) {
        res.status(500).json({
            message: "Error fetching users",
            error: error.message
        });
    }
});

// ✅ DELETE → Delete User
app.delete("/admin/users/:id", async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            message: "User deleted",
            data: user
        });

    } catch (error) {
        res.status(500).json({
            message: "Error deleting user",
            error: error.message
        });
    }
});

// ✅ PUT → Update User
app.put("/admin/users/:id", async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            message: "User updated",
            data: user
        });

    } catch (error) {
        res.status(500).json({
            message: "Error updating user",
            error: error.message
        });
    }
});

// ================= SERVER =================
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});