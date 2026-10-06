require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { requireAuth } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/students");
const metaRoutes = require("./routes/meta");
const sessionRoutes = require("./routes/sessions");
const attendanceRoutes = require("./routes/attendance");
const reportRoutes = require("./routes/reports");
const notificationRoutes = require("./routes/notifications");
const webhookRoutes = require("./routes/webhook");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "6mb" })); // photos are sent as base64 in JSON, so allow a larger body

// Public routes
app.use("/api/auth", authRoutes);
// WhatsApp webhook must stay public — Meta calls it directly (no admin token)
app.use("/api/webhook", webhookRoutes);

// Protected admin routes (every school's admin only ever sees their own data)
app.use("/api/students", requireAuth, studentRoutes);
app.use("/api/meta", requireAuth, metaRoutes);
app.use("/api/sessions", requireAuth, sessionRoutes);
app.use("/api/attendance", requireAuth, attendanceRoutes);
app.use("/api/reports", requireAuth, reportRoutes);
app.use("/api/notifications", requireAuth, notificationRoutes);

// Static frontend
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log("======================================================");
  console.log("  Vidya Setu - Multi-School Management System");
  console.log(`  Server running at: http://localhost:${PORT}`);
  console.log("  Backend: Supabase (see .env / SETUP.md)");
  console.log("  No default login — sign up your school from the");
  console.log("  'Register School' tab on the login page.");
  console.log("======================================================");
});
