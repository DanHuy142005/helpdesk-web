CREATE TABLE password_reset_challenges (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  password_fingerprint text NOT NULL,
  expires_at timestamptz NOT NULL
);

-- Remove implementation/fixture descriptions from unchanged initialization records.
UPDATE ticket_events SET note='Yêu cầu hỗ trợ được ghi nhận.'
WHERE note='Dữ liệu minh họa được lưu trong PostgreSQL';
UPDATE ticket_events SET note='Admin phân công người xử lý.'
WHERE note='Admin phân công dữ liệu minh họa';
UPDATE asset_assignments SET reason='Cấp phát thiết bị phục vụ công việc.'
WHERE reason='Cấp phát dữ liệu minh họa ban đầu';
UPDATE audit_log SET action='initialize', details='{"initialized":true}'::jsonb
WHERE action='seed' AND entity='system' AND entity_id='initial' AND details='{"demo":true}'::jsonb;
