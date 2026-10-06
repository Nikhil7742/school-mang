-- ============================================================
-- Vidya Setu — Supabase schema
-- Run this ONCE in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste all -> Run)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- SCHOOLS  (one row per school/tenant using this software)
-- ---------------------------------------------------------------
create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text default '',
  phone text default '',
  email text default '',
  active_session_id uuid,
  -- Per-school WhatsApp Cloud API credentials (each school can connect
  -- its own WhatsApp Business number from Settings inside the app).
  whatsapp_token text,
  whatsapp_phone_number_id text,
  whatsapp_verify_token text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- ACADEMIC SESSIONS  (e.g. "2025-2026", "2026-2027")
-- Every school's data (class, roll no, marks, fees) is scoped to a
-- session so old years stay intact when a new session starts.
-- ---------------------------------------------------------------
create table if not exists academic_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  label text not null,                 -- e.g. '2026-2027'
  start_date date,
  end_date date,
  is_active boolean not null default false,
  reg_counters jsonb not null default '{}'::jsonb,   -- { "5": 12, "10": 3, ... } running admission-no. counters per class
  created_at timestamptz not null default now()
);

alter table schools
  drop constraint if exists fk_schools_active_session,
  add constraint fk_schools_active_session
  foreign key (active_session_id) references academic_sessions(id) on delete set null;

-- ---------------------------------------------------------------
-- ADMIN USERS  (school-staff logins — username is unique across the
-- whole product so the login screen stays a single username+password
-- box; each username belongs to exactly one school)
-- ---------------------------------------------------------------
create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  username text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- STUDENTS  (permanent identity — survives across sessions/years)
-- ---------------------------------------------------------------
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  reg_no text not null,
  name text not null,
  father_name text not null,
  mother_name text default '',
  dob date not null,
  gender text default '',
  address text default '',
  contact text default '',              -- WhatsApp / primary parent number (used for report sending)
  alt_contact text default '',
  email text default '',
  photo_url text,                        -- base64 data-URL or a Supabase Storage public URL
  admission_date date default now(),
  created_at timestamptz not null default now(),
  unique (school_id, reg_no)
);

-- ---------------------------------------------------------------
-- ENROLLMENTS  (a student's class/roll/subjects/marks/fees for ONE
-- specific academic session — this is what makes year-wise history
-- possible)
-- ---------------------------------------------------------------
create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  session_id uuid not null references academic_sessions(id) on delete cascade,
  class text not null,
  section text default 'A',
  stream text,
  roll_no text not null,
  subjects jsonb not null default '[]'::jsonb,
  marks jsonb not null default '{}'::jsonb,
  fees jsonb not null default '{"totalFee":0,"paidFee":0}'::jsonb,
  created_at timestamptz not null default now(),
  unique (school_id, session_id, class, section, roll_no)
);

-- ---------------------------------------------------------------
-- ATTENDANCE RECORDS  (one row per student per calendar day)
-- ---------------------------------------------------------------
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  session_id uuid not null references academic_sessions(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'leave')),
  marked_at timestamptz not null default now(),
  unique (school_id, student_id, date)
);

-- ---------------------------------------------------------------
-- REPORT LOGS  (history of WhatsApp report cards sent to parents)
-- ---------------------------------------------------------------
create table if not exists report_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  session_id uuid references academic_sessions(id) on delete set null,
  sent_at timestamptz not null default now(),
  description text default '',
  to_number text,
  simulated boolean not null default true
);

-- ---------------------------------------------------------------
-- NOTIFICATIONS  (inbound WhatsApp replies from parents, shown in
-- the admin bell/notification panel)
-- ---------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  student_name text,
  from_number text,
  message text,
  received_at timestamptz not null default now(),
  read boolean not null default false
);

-- ---------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------
create index if not exists idx_sessions_school on academic_sessions(school_id);
create index if not exists idx_students_school on students(school_id);
create index if not exists idx_enrollments_school_session on enrollments(school_id, session_id);
create index if not exists idx_enrollments_student on enrollments(student_id);
create index if not exists idx_attendance_school_session_date on attendance_records(school_id, session_id, date);
create index if not exists idx_attendance_student on attendance_records(student_id);
create index if not exists idx_notifications_school_read on notifications(school_id, read);
create index if not exists idx_report_logs_student on report_logs(student_id);

-- ---------------------------------------------------------------
-- Row Level Security
-- The Node backend talks to Supabase using the SERVICE ROLE key,
-- which bypasses RLS by design (the backend itself enforces
-- school_id scoping on every query). RLS is still enabled here as a
-- defense-in-depth safety net in case the anon/public key is ever
-- used directly against these tables from a browser.
-- ---------------------------------------------------------------
alter table schools enable row level security;
alter table academic_sessions enable row level security;
alter table admin_users enable row level security;
alter table students enable row level security;
alter table enrollments enable row level security;
alter table attendance_records enable row level security;
alter table report_logs enable row level security;
alter table notifications enable row level security;

-- No policies are created for the anon/public role, so with RLS on
-- and only the anon key, every table is inaccessible from the
-- browser — exactly what we want, since all reads/writes must go
-- through the Node backend (service role key).
