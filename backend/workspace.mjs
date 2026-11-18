import { ticketScope, publicUser } from "./security.mjs";
import { ticketSelect } from "./tickets.mjs";

export async function workspace(pool, user, range = {}) {
  const scope = ticketScope(user);
  const values = [...scope.values];
  let filter = scope.sql;
  if (range.from) {
    values.push(range.from);
    filter += ` AND t.created_at >= $${values.length}::date`;
  }
  if (range.to) {
    values.push(range.to);
    filter += ` AND t.created_at < $${values.length}::date + interval '1 day'`;
  }
  const [tickets, users, departments, assets, software, documents, notifications, audits, events] =
    await Promise.all([
      pool.query(`${ticketSelect} WHERE ${filter} ORDER BY t.created_at DESC`, values),
      pool.query(
        `SELECT u.id,u.code,u.name,u.email,u.role,u.department_id,u.position,u.active,d.name department,
      CASE WHEN $1='admin' OR u.id=$2 THEN u.phone ELSE NULL END phone,
      (SELECT count(*)::int FROM asset_assignments aa WHERE aa.user_id=u.id AND aa.ended_at IS NULL) devices
      FROM users u LEFT JOIN departments d ON d.id=u.department_id
      WHERE $1='admin' OR u.id=$2 OR ($1 IN ('helpdesk','technician') AND u.id IN (SELECT requester_id FROM tickets WHERE assignee_id=$2)) ORDER BY u.code`,
        [user.role, user.id],
      ),
      pool.query(
        `SELECT d.*, (SELECT count(*)::int FROM users u WHERE u.department_id=d.id) staff,
      (SELECT count(*)::int FROM tickets t JOIN users u ON u.id=t.requester_id WHERE u.department_id=d.id AND t.status NOT IN ('Đã đóng','Đã giải quyết')) open_tickets,
      (SELECT count(*)::int FROM asset_assignments a WHERE a.department_id=d.id AND a.ended_at IS NULL) assets,
      (SELECT round(avg(t.rating)*20)::int FROM tickets t JOIN users u ON u.id=t.requester_id WHERE u.department_id=d.id) satisfaction
      FROM departments d WHERE $1='admin' ORDER BY d.name`,
        [user.role],
      ),
      pool.query(
        `SELECT a.*,u.name owner,aa.user_id owner_id,d.name department FROM assets a
      LEFT JOIN asset_assignments aa ON aa.asset_id=a.id AND aa.ended_at IS NULL LEFT JOIN users u ON u.id=aa.user_id LEFT JOIN departments d ON d.id=aa.department_id
      WHERE $1='admin' OR aa.user_id=$2 OR ($1 IN ('helpdesk','technician') AND EXISTS(SELECT 1 FROM tickets t WHERE t.asset_id=a.id AND t.assignee_id=$2)) ORDER BY a.id`,
        [user.role, user.id],
      ),
      user.role === "admin"
        ? pool.query(`SELECT s.*,(SELECT count(*)::int FROM software_installations i WHERE i.software_id=s.id) used,
      coalesce((SELECT json_agg(i.asset_id) FROM software_installations i WHERE i.software_id=s.id),'[]') installations FROM software s ORDER BY s.name`)
        : Promise.resolve({ rows: [] }),
      pool.query(
        `SELECT d.id,d.title,d.category,d.content,d.visibility,d.published,d.author_id,d.views,d.updated_at,u.name owner,
      octet_length(d.content)::int + coalesce((SELECT sum(size) FROM attachments a WHERE a.document_id=d.id),0)::int bytes
      FROM documents d JOIN users u ON u.id=d.author_id
      WHERE $1='admin' OR (d.published AND ($1<>'end-user' OR d.visibility='public')) OR ($1<>'end-user' AND d.author_id=$2) ORDER BY d.updated_at DESC`,
        [user.role, user.id],
      ),
      pool.query(
        `SELECT n.id,n.message,n.ticket_id,n.read_at,n.created_at FROM notifications n WHERE n.user_id=$1
          AND (n.ticket_id IS NULL OR EXISTS(SELECT 1 FROM tickets t WHERE t.id=n.ticket_id AND ${ticketScope(user, "t", 2).sql}))
          ORDER BY n.created_at DESC LIMIT 100`,
        [user.id, ...scope.values],
      ),
      user.role === "admin"
        ? pool.query(
            "SELECT a.*,u.name actor FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 300",
          )
        : Promise.resolve({ rows: [] }),
      pool.query(
        `SELECT e.*,COALESCE(u.name,'Hệ thống') actor,a.name assignee FROM ticket_events e JOIN tickets t ON t.id=e.ticket_id LEFT JOIN users u ON u.id=e.actor_id LEFT JOIN users a ON a.id=e.assignee_id WHERE ${scope.sql} ORDER BY e.created_at DESC LIMIT 500`,
        scope.values,
      ),
    ]);
  return {
    user: publicUser(user),
    tickets: tickets.rows,
    users: users.rows,
    departments: departments.rows,
    assets: assets.rows,
    software: software.rows,
    documents: documents.rows,
    notifications: notifications.rows,
    audits: audits.rows,
    events: events.rows,
    serverTime: new Date().toISOString(),
  };
}
