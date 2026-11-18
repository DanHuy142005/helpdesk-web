ALTER TABLE users ADD COLUMN phone text UNIQUE;
DELETE FROM password_reset_challenges;
ALTER TABLE password_reset_challenges ADD COLUMN phone text;

CREATE TABLE password_reset_otps (
  token_hash text PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  otp_hash text NOT NULL,
  password_fingerprint text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE ticket_policy (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  auto_close_enabled boolean NOT NULL DEFAULT false,
  auto_close_minutes integer NOT NULL DEFAULT 1440 CHECK (auto_close_minutes BETWEEN 1 AND 525600),
  version integer NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ticket_policy(id) VALUES(true);

ALTER TABLE tickets ADD COLUMN requested_priority text;
ALTER TABLE tickets ADD COLUMN requested_category text;
ALTER TABLE tickets ADD COLUMN requested_asset_id text REFERENCES assets(id);
ALTER TABLE tickets ADD COLUMN classified_by uuid REFERENCES users(id);
ALTER TABLE tickets ADD COLUMN classification_confirmed_at timestamptz;
ALTER TABLE tickets ADD COLUMN closed_automatically boolean NOT NULL DEFAULT false;
ALTER TABLE tickets ADD COLUMN sla_alert_due_at timestamptz;
ALTER TABLE tickets ADD COLUMN sla_alert_assignee_id uuid REFERENCES users(id);
UPDATE tickets SET requested_priority=priority,requested_category=category,requested_asset_id=asset_id,
  classified_by=assigned_by,classification_confirmed_at=CASE WHEN assigned_by IS NOT NULL THEN coalesce(accepted_at,updated_at) ELSE NULL END;
ALTER TABLE tickets ALTER COLUMN requested_priority SET NOT NULL;
ALTER TABLE tickets ALTER COLUMN requested_category SET NOT NULL;
ALTER TABLE tickets ADD CONSTRAINT requested_priority_values CHECK(requested_priority IN ('Khẩn cấp','Cao','Trung bình','Thấp'));
ALTER TABLE ticket_events ALTER COLUMN actor_id DROP NOT NULL;
CREATE INDEX tickets_auto_close_idx ON tickets(resolved_at) WHERE status='Đã giải quyết';

-- Update only the unchanged policy article supplied at initialization.
UPDATE documents SET content='Sử dụng mật khẩu riêng cho từng hệ thống, tối thiểu 7 ký tự. Không chia sẻ mật khẩu qua Ticket. Báo ngay Helpdesk khi nghi ngờ bị lộ tài khoản.',updated_at=now()
WHERE title='Chính sách bảo mật tài khoản' AND content='Sử dụng mật khẩu riêng cho từng hệ thống, tối thiểu 12 ký tự. Không chia sẻ mật khẩu qua Ticket. Báo ngay Helpdesk khi nghi ngờ bị lộ tài khoản.';
