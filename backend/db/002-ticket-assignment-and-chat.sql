-- Upgrade existing localhost databases without removing tickets, notes or history.
ALTER TABLE tickets ADD COLUMN queue_role text CHECK (queue_role IN ('helpdesk'));
ALTER TABLE tickets ADD COLUMN assigned_by uuid REFERENCES users(id);

CREATE TABLE ticket_messages (
  id uuid PRIMARY KEY,
  ticket_id text NOT NULL REFERENCES tickets(id),
  sender_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_messages_thread_idx ON ticket_messages(ticket_id, created_at, id);
CREATE INDEX tickets_pending_assignment_idx ON tickets(queue_role, created_at) WHERE assignee_id IS NULL;

-- Keep previous public exchanges in the conversation; internal notes stay separate.
INSERT INTO ticket_messages(id, ticket_id, sender_id, body, created_at)
SELECT id, ticket_id, author_id, body, created_at FROM ticket_comments
WHERE NOT internal AND length(trim(body)) BETWEEN 1 AND 10000;

-- The old "Đã chuyển" state meant Helpdesk assigned a technician. Preserve its
-- historical events, while existing assigned work resumes under the new workflow.
UPDATE tickets SET status='Đang xử lý', version=version+1, updated_at=now()
WHERE status='Đã chuyển' AND assignee_id IS NOT NULL;
