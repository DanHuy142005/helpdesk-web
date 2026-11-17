CREATE TABLE IF NOT EXISTS departments (
  id text PRIMARY KEY, name text NOT NULL UNIQUE, head text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL,
  email text NOT NULL UNIQUE, password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','helpdesk','technician','end-user')),
  department_id text REFERENCES departments(id), position text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS assets (
  id text PRIMARY KEY, name text NOT NULL, type text NOT NULL, serial text UNIQUE,
  location text NOT NULL DEFAULT '', warranty date, notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Trong kho' CHECK(status IN ('Trong kho','Đang sử dụng','Bảo trì','Thanh lý')),
  specs jsonb NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS asset_assignments (
  id uuid PRIMARY KEY, asset_id text NOT NULL REFERENCES assets(id),
  user_id uuid NOT NULL REFERENCES users(id), department_id text REFERENCES departments(id),
  actor_id uuid NOT NULL REFERENCES users(id), started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz, condition text NOT NULL, reason text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_assignment ON asset_assignments(asset_id) WHERE ended_at IS NULL;
CREATE TABLE IF NOT EXISTS software (
  id uuid PRIMARY KEY, name text NOT NULL UNIQUE, vendor text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT '', license_type text NOT NULL,
  seats integer NOT NULL CHECK(seats > 0), expires date
);
CREATE TABLE IF NOT EXISTS software_installations (
  software_id uuid NOT NULL REFERENCES software(id), asset_id text NOT NULL REFERENCES assets(id),
  actor_id uuid NOT NULL REFERENCES users(id), installed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(software_id, asset_id)
);
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY, title text NOT NULL, category text NOT NULL,
  content text NOT NULL, published boolean NOT NULL DEFAULT false,
  visibility text NOT NULL CHECK(visibility IN ('public','internal')),
  author_id uuid NOT NULL REFERENCES users(id), views integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS ticket_number START 10001;
CREATE TABLE IF NOT EXISTS tickets (
  id text PRIMARY KEY DEFAULT ('TK-' || nextval('ticket_number')),
  title text NOT NULL, description text NOT NULL, category text NOT NULL,
  priority text NOT NULL CHECK(priority IN ('Khẩn cấp','Cao','Trung bình','Thấp')),
  status text NOT NULL DEFAULT 'Mới' CHECK(status IN ('Mới','Đang xử lý','Chờ phản hồi','Đã chuyển','Đã giải quyết','Đã đóng')),
  requester_id uuid NOT NULL REFERENCES users(id), assignee_id uuid REFERENCES users(id),
  asset_id text REFERENCES assets(id), solution text NOT NULL DEFAULT '',
  due_at timestamptz NOT NULL, accepted_at timestamptz, resolved_at timestamptz,
  closed_at timestamptz, rating integer CHECK(rating BETWEEN 1 AND 5),
  feedback text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_requester_idx ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS tickets_assignee_idx ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status, created_at);
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY, ticket_id text NOT NULL REFERENCES tickets(id),
  author_id uuid NOT NULL REFERENCES users(id), body text NOT NULL,
  internal boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ticket_events (
  id uuid PRIMARY KEY, ticket_id text NOT NULL REFERENCES tickets(id), actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL, note text NOT NULL DEFAULT '', from_status text, to_status text NOT NULL,
  assignee_id uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY, ticket_id text REFERENCES tickets(id), document_id uuid REFERENCES documents(id),
  author_id uuid NOT NULL REFERENCES users(id), name text NOT NULL, mime text NOT NULL,
  data bytea NOT NULL, size integer NOT NULL CHECK(size <= 5242880), created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((ticket_id IS NOT NULL)::int + (document_id IS NOT NULL)::int = 1)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL,
  entity text NOT NULL, entity_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), message text NOT NULL,
  ticket_id text REFERENCES tickets(id), read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
