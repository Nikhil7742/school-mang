// ============================================================
// Supabase client (server-side, uses the SERVICE ROLE key)
// ============================================================
// This key must ONLY ever be used on the server. Never send it to
// the browser / frontend. The Node backend is what enforces that
// every query is scoped to the logged-in admin's school_id.
// ============================================================

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "\n[Vidya Setu] WARNING: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.\n" +
      "The app will not be able to read or write any data until you create a .env file\n" +
      "(see .env.example) with your Supabase project credentials.\n"
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Small helper: throws a readable error if a Supabase call failed,
// otherwise returns `data`. Keeps route handlers short.
function unwrap(result, fallbackMessage) {
  const { data, error } = result;
  if (error) {
    const err = new Error(error.message || fallbackMessage || "Database error.");
    err.status = error.code === "23505" ? 409 : 500; // unique_violation -> conflict
    throw err;
  }
  return data;
}

module.exports = { supabase, unwrap };
