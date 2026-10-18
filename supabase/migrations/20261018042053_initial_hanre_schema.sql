-- Hanre Studio's Supabase Postgres schema.
-- App-generated TEXT IDs are preserved so existing UUID-style ids migrate unchanged.
CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  avatar_color text NOT NULL DEFAULT '#8b7bff',
  prefs text NOT NULL DEFAULT '{}',
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.projects (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'javascript',
  color text NOT NULL DEFAULT '#8b7bff',
  is_archived smallint NOT NULL DEFAULT 0,
  favorite smallint NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'blank',
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.files (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  name text NOT NULL,
  is_dir smallint NOT NULL DEFAULT 0,
  language text NOT NULL DEFAULT 'plaintext',
  content text NOT NULL DEFAULT '',
  created_at text NOT NULL,
  updated_at text NOT NULL,
  UNIQUE(project_id, path)
);

CREATE TABLE IF NOT EXISTS public.snippets (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'javascript',
  code text NOT NULL DEFAULT '',
  tags text NOT NULL DEFAULT '[]',
  is_starred smallint NOT NULL DEFAULT 0,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id text REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'backlog',
  priority text NOT NULL DEFAULT 'medium',
  due_date text,
  position double precision NOT NULL DEFAULT 0,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.runs (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id text REFERENCES public.projects(id) ON DELETE SET NULL,
  file_id text REFERENCES public.files(id) ON DELETE SET NULL,
  command text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'javascript',
  status text NOT NULL DEFAULT 'success',
  output text NOT NULL DEFAULT '',
  duration_ms integer NOT NULL DEFAULT 0,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.file_versions (
  id text PRIMARY KEY,
  file_id text NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.shares (
  id text PRIMARY KEY,
  project_id text NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  views integer NOT NULL DEFAULT 0,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.activity (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  message text NOT NULL,
  project_id text,
  created_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_files_project ON public.files(project_id);
CREATE INDEX IF NOT EXISTS idx_snippets_user ON public.snippets(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_user ON public.runs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.activity(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_versions_file ON public.file_versions(file_id, created_at);
CREATE INDEX IF NOT EXISTS idx_shares_slug ON public.shares(slug);

-- No public/anon policies: all data access must go through the trusted app server.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;
