// Helpers around academic_sessions — every piece of class/roll/marks/
// fees/attendance data is scoped to one of these rows so that
// switching the session (e.g. "View 2026-2027" vs "View 2025-2026")
// shows a completely different, historically-accurate slice of data.

const { supabase, unwrap } = require("./supabaseClient");

// Returns the school's active session, creating a default one
// ("<currentYear>-<currentYear+1>") if the school has none yet.
async function getActiveSession(schoolId) {
  const school = unwrap(
    await supabase.from("schools").select("*").eq("id", schoolId).single(),
    "School not found."
  );

  if (school.active_session_id) {
    const session = unwrap(
      await supabase.from("academic_sessions").select("*").eq("id", school.active_session_id).eq("school_id", schoolId).maybeSingle()
    );
    if (session) return session;
  }

  // No active session yet — create one automatically.
  const year = new Date().getFullYear();
  const label = `${year}-${year + 1}`;
  const created = unwrap(
    await supabase
      .from("academic_sessions")
      .insert({ school_id: schoolId, label, is_active: true, reg_counters: {} })
      .select()
      .single(),
    "Could not create academic session."
  );
  unwrap(await supabase.from("schools").update({ active_session_id: created.id }).eq("id", schoolId));
  return created;
}

// Resolves which session a request is "looking at": an explicit
// ?sessionId= query param (used for the "View previous session" flow)
// falls back to the school's current active session.
async function resolveRequestedSession(schoolId, requestedSessionId) {
  if (requestedSessionId) {
    const session = unwrap(
      await supabase.from("academic_sessions").select("*").eq("id", requestedSessionId).eq("school_id", schoolId).maybeSingle()
    );
    if (session) return session;
  }
  return getActiveSession(schoolId);
}

async function listSessions(schoolId) {
  return unwrap(
    await supabase
      .from("academic_sessions")
      .select("*")
      .eq("school_id", schoolId)
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
  );
}

module.exports = { getActiveSession, resolveRequestedSession, listSessions };
