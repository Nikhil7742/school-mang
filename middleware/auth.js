const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "vidya-setu-secret-key-change-in-production";

function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Login required. Please sign in again." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.schoolId) {
      return res.status(401).json({ error: "Session invalid. Please sign in again." });
    }
    // req.user carries schoolId — every route MUST filter its Supabase
    // queries by this value so one school can never see another's data.
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

module.exports = { requireAuth, JWT_SECRET };
