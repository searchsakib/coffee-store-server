// Required dependencies
require("dotenv").config(); // Load environment variables
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const router = express.Router();

// Environment variables with defaults
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/worddb";
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// User Schema for authentication
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "user"], default: "user" },
});

// Word Collection Schema with enhanced metadata
const wordSchema = new mongoose.Schema({
  words: [String],
  category: { type: String, default: "general", index: true },
  totalWords: Number,
  lastUsed: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Models
const User = mongoose.model("User", userSchema);
const WordCollection = mongoose.model("WordCollection", wordSchema);

// Middleware for authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({ message: "Invalid or expired token" });
    req.user = user;
    next();
  });
};

// Middleware for admin authorization
const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Authentication Routes
router.post("/register", async (req, res) => {
  try {
    const { username, password, role = "user" } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      username,
      password: hashedPassword,
      role,
    });

    await user.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Word Collection Routes
router.post("/words", authenticateToken, async (req, res) => {
  try {
    const { words, category = "general" } = req.body;

    const wordCollection = new WordCollection({
      words,
      category,
      totalWords: words.length,
      createdBy: req.user.userId,
    });

    await wordCollection.save();
    res.status(201).json({ message: "Words added successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/random", authenticateToken, async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 1;
    const category = req.query.category || "general";

    const wordDoc = await WordCollection.findOne({ category });

    if (!wordDoc || !wordDoc.words.length) {
      return res.status(404).json({ message: "No words found" });
    }

    // Get random words using Fisher-Yates shuffle algorithm
    const getRandomWords = (arr, n) => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, n);
    };

    const randomWords = getRandomWords(wordDoc.words, count);

    // Update last used timestamp
    await WordCollection.updateOne(
      { _id: wordDoc._id },
      {
        $set: {
          lastUsed: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    res.json({ words: randomWords });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/words", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category || "general";
    const search = req.query.search || "";

    // Build query
    const query = { category };
    if (search) {
      query.words = { $regex: search, $options: "i" };
    }

    // Get total count for pagination
    const total = await WordCollection.countDocuments(query);

    // Get paginated results
    const wordDoc = await WordCollection.findOne(query)
      .skip((page - 1) * limit)
      .limit(limit);

    if (!wordDoc) {
      return res.status(404).json({ message: "No words found" });
    }

    // Prepare paginated response
    const response = {
      words: wordDoc.words,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      metadata: {
        category: wordDoc.category,
        lastUsed: wordDoc.lastUsed,
        createdAt: wordDoc.createdAt,
        updatedAt: wordDoc.updatedAt,
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin-only routes
router.put("/words", authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { words, category = "general" } = req.body;

    const result = await WordCollection.updateOne(
      { category },
      {
        $addToSet: { words: { $each: words } },
        $set: {
          updatedAt: new Date(),
          lastUsed: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({ message: "Words updated successfully", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/words", authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { words, category = "general" } = req.body;

    const result = await WordCollection.updateOne(
      { category },
      {
        $pull: { words: { $in: words } },
        $set: { updatedAt: new Date() },
      }
    );

    res.json({ message: "Words deleted successfully", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express app setup
const app = express();
app.use(express.json());
app.use("/api", router);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
