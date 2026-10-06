const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { supabase, unwrap } = require("../utils/supabaseClient");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

function issueToken(adminUser, school) {
  return jwt.sign(
    {
      id: adminUser.id,
      username: adminUser.username,
      name: adminUser.name,
      role: "admin",
      schoolId: school.id,
      schoolName: school.name
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

// ---- Admin login ----
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const adminUser = unwrap(
    await supabase.from("admin_users").select("*").ilike("username", String(username).trim()).maybeSingle()
  );
  if (!adminUser) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const valid = bcrypt.compareSync(password, adminUser.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const school = unwrap(await supabase.from("schools").select("*").eq("id", adminUser.school_id).single());

  const token = issueToken(adminUser, school);
  res.json({ token, user: { name: adminUser.name, username: adminUser.username, schoolName: school.name } });
});

// ---- New school sign-up ----
// Lets a new school start using the software with its own username +
// password, completely isolated from every other school's data.
router.post("/register-school", async (req, res) => {
  const { schoolName, adminName, username, password, address, phone, email } = req.body || {};

  if (!schoolName || !adminName || !username || !password) {
    return res.status(400).json({ error: "School name, your name, a username and a password are all required." });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const existing = unwrap(
    await supabase.from("admin_users").select("id").ilike("username", String(username).trim()).maybeSingle()
  );
  if (existing) {
    return res.status(409).json({ error: "This username is already taken. Please choose another one." });
  }

  const school = unwrap(
    await supabase
      .from("schools")
      .insert({
        name: schoolName.trim(),
        address: address || "",
        phone: phone || "",
        email: email || ""
      })
      .select()
      .single(),
    "Could not create school."
  );

  const year = new Date().getFullYear();
  const session = unwrap(
    await supabase
      .from("academic_sessions")
      .insert({ school_id: school.id, label: `${year}-${year + 1}`, is_active: true, reg_counters: {} })
      .select()
      .single(),
    "Could not create the first academic session."
  );
  unwrap(await supabase.from("schools").update({ active_session_id: session.id }).eq("id", school.id));

  const passwordHash = bcrypt.hashSync(password, 10);
  const adminUser = unwrap(
    await supabase
      .from("admin_users")
      .insert({ school_id: school.id, username: username.trim(), name: adminName.trim(), password_hash: passwordHash })
      .select()
      .single(),
    "Could not create admin login."
  );

  const token = issueToken(adminUser, school);
  res.status(201).json({ token, user: { name: adminUser.name, username: adminUser.username, schoolName: school.name } });
});

module.exports = router;
