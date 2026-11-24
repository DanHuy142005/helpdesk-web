import { useWorkspace } from "./client";
import { chartColors as c } from "../lib/chartColors";
import { isOpenTicketStatus, type TicketStatus } from "../lib/ticket";
import type { Tone } from "../lib/tones";
import type { Role } from "./types";
export const categories = [
  "Tài khoản & Quyền",
  "Email & Office",
  "Phần cứng",
  "Phần mềm",
  "Mạng & VPN",
  "Thiết bị ngoại vi",
  "Khác",
];
const colors = [c.violet, c.blue, c.cyan, c.orange, c.green, c.pink, c.yellow];
const format = (date: string | null | undefined) =>
  date ? new Date(date).toLocaleDateString("vi-VN") : "—";
const time = (date: string) =>
  new Date(date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
const completed = (status: TicketStatus) => ["Đã giải quyết", "Đã đóng"].includes(status);
const avg = (values: number[]) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const roleLabels: Record<Role, "Admin" | "Helpdesk" | "Technician" | "End User"> = {
  admin: "Admin",
  helpdesk: "Helpdesk",
  technician: "Technician",
  "end-user": "End User",
};
export function usePortalData(range?: { from: string; to: string }) {
  const { data: w } = useWorkspace();
  if (!w) throw new Error("Workspace not loaded");
  const now = new Date(w.serverTime);
  const rawTickets = w.tickets.filter(
    (t) =>
      (!range?.from || t.created_at.slice(0, 10) >= range.from) &&
      (!range?.to || t.created_at.slice(0, 10) <= range.to),
  );
  const tickets = rawTickets.map((t) => ({
    ...t,
    requester: t.requester || "—",
    department: t.department || "—",
    assignee:
      t.assignee ||
      (t.status === "Đã thu hồi"
        ? "—"
        : t.queue_role === "helpdesk"
          ? "Chờ Admin phân công Helpdesk"
          : "Chờ Admin phân công"),
    createdAt: format(t.created_at),
    updatedAt: new Date(t.updated_at).toLocaleString("vi-VN"),
    progress: {
      Mới: 0,
      "Đang xử lý": 50,
      "Chờ phản hồi": 60,
      "Đã chuyển": 35,
      "Đã giải quyết": 90,
      "Đã đóng": 100,
      "Đã thu hồi": 0,
    }[t.status],
    channel: "Cổng web" as const,
    waiting: Math.max(0, Math.floor((now.getTime() - Date.parse(t.created_at)) / 60000)) + " phút",
    slaLeft:
      t.status === "Đã thu hồi"
        ? "—"
        : (Date.parse(t.due_at) < now.getTime() ? "Quá hạn " : "Còn ") +
          Math.abs(Math.round((Date.parse(t.due_at) - now.getTime()) / 60000)) +
          " phút",
    slaRisk: isOpenTicketStatus(t.status) && Date.parse(t.due_at) - now.getTime() < 15 * 60000,
  }));
  const monthlyTickets = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1),
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const month = tickets.filter((t) => t.created_at.startsWith(key));
    return {
      month: `T${date.getMonth() + 1}`,
      moi: month.filter((t) => t.status === "Mới").length,
      dangXuLy: month.filter((t) => isOpenTicketStatus(t.status) && t.status !== "Mới").length,
      daGiaiQuyet: month.filter((t) => completed(t.status)).length,
      daGui: month.length,
      daXong: month.filter((t) => completed(t.status)).length,
    };
  });
  const group = (key: "category" | "department" | "priority", items = tickets) =>
    Array.from(new Set(items.map((t) => t[key]))).map((name, i) => ({
      name,
      value: items.filter((t) => t[key] === name).length,
      color: colors[i % colors.length]!,
      share: pct(items.filter((t) => t[key] === name).length, items.length),
    }));
  const assets = w.assets.map((a) => ({
    ...a,
    code: a.id,
    owner: a.owner || "—",
    department: a.department || "Kho CNTT",
    warranty: format(a.warranty),
    lastTicket: tickets.find((t) => t.asset_id === a.id)?.id || "—",
    tickets: tickets.filter((t) => t.asset_id === a.id).length,
  }));
  const employees = w.users.map((u) => ({
    ...u,
    key: u.id,
    id: u.code,
    role: roleLabels[u.role],
    department: u.department || "—",
    devices: u.devices || 0,
    status: (u.active ? "Đang làm việc" : "Tạm khóa") as "Đang làm việc" | "Tạm khóa",
  }));
  const departments = w.departments.map((d) => ({
    ...d,
    code: d.id,
    openTickets: d.open_tickets,
    satisfaction: d.satisfaction ?? 0,
  }));
  const documents = w.documents.map((d) => ({
    ...d,
    updated: format(d.updated_at),
    size: (d.bytes / 1024).toFixed(1) + " KB",
  }));
  const articles = documents.map((d) => ({
    ...d,
    summary: d.content.slice(0, 130),
    minutes: Math.max(1, Math.ceil(d.content.split(/\s+/).length / 200)),
    views: String(d.views),
    popular: d.published,
  }));
  const technicians = w.users
    .filter((u) => u.role === "technician" && u.active)
    .map((u) => {
      const active = tickets.filter(
        (t) => t.assignee_id === u.id && isOpenTicketStatus(t.status),
      ).length;
      return {
        id: u.id,
        name: u.name,
        skill: u.position,
        load: Math.min(100, pct(active, 8)),
        active,
        status: (active >= 8 ? "Bận" : "Sẵn sàng") as "Bận" | "Sẵn sàng",
      };
    });
  const jobs = tickets
    .filter((t) => isOpenTicketStatus(t.status))
    .map((t) => ({
      ...t,
      location: t.location || t.department,
      device: t.asset_id || "Chưa liên kết",
      due: new Date(t.due_at).toLocaleString("vi-VN"),
      slaPct: Math.max(
        0,
        Math.min(
          100,
          pct(
            now.getTime() - Date.parse(t.created_at),
            Date.parse(t.due_at) - Date.parse(t.created_at),
          ),
        ),
      ),
      from:
        t.assigned_by_name ||
        w.events.find((e) => e.ticket_id === t.id && e.action === "assign")?.actor ||
        "Phân công trước cập nhật",
    }));
  const results = tickets
    .filter((t) => completed(t.status))
    .map((t) => ({
      ...t,
      duration: t.resolved_at
        ? Math.max(
            0,
            Math.round(
              (Date.parse(t.resolved_at) - Date.parse(t.accepted_at || t.created_at)) / 60000,
            ),
          ) + " phút"
        : "—",
      closedAt: format(t.closed_at || t.resolved_at),
      rating: t.rating || 0,
    }));
  const solved = tickets.filter((t) => completed(t.status)),
    rated = tickets.filter((t) => t.rating !== null);
  const stats = {
    total: tickets.length,
    new: tickets.filter((t) => t.status === "Mới").length,
    unassigned: tickets.filter((t) => !t.assignee_id && isOpenTicketStatus(t.status)).length,
    pendingHelpdesk: tickets.filter((t) => !t.assignee_id && t.queue_role === "helpdesk").length,
    active: tickets.filter((t) => isOpenTicketStatus(t.status)).length,
    processing: tickets.filter((t) => t.status === "Đang xử lý").length,
    waiting: tickets.filter((t) => t.status === "Chờ phản hồi").length,
    escalated: tickets.filter((t) => t.status === "Đã chuyển").length,
    resolved: tickets.filter((t) => t.status === "Đã giải quyết").length,
    closed: tickets.filter((t) => t.status === "Đã đóng").length,
    solved: solved.length,
    monthSolved: solved.filter(
      (t) =>
        t.resolved_at &&
        new Date(t.resolved_at).getMonth() === now.getMonth() &&
        new Date(t.resolved_at).getFullYear() === now.getFullYear(),
    ).length,
    weekSolved: solved.filter(
      (t) => t.resolved_at && now.getTime() - Date.parse(t.resolved_at) <= 7 * 86400000,
    ).length,
    ratings: rated.length,
    rating: rated.length
      ? (rated.reduce((n, t) => n + (t.rating || 0), 0) / rated.length).toFixed(1)
      : "—",
    csat: rated.length
      ? pct(rated.filter((t) => (t.rating || 0) >= 4).length, rated.length) + "%"
      : "—",
    response: avg(
      tickets
        .filter((t) => t.accepted_at)
        .map((t) => Math.max(0, (Date.parse(t.accepted_at!) - Date.parse(t.created_at)) / 60000)),
    ),
    duration: avg(
      solved
        .filter((t) => t.resolved_at)
        .map((t) =>
          Math.max(
            0,
            (Date.parse(t.resolved_at!) - Date.parse(t.accepted_at || t.created_at)) / 60000,
          ),
        ),
    ),
    sla: pct(
      tickets.filter((t) => t.accepted_at && Date.parse(t.accepted_at) <= Date.parse(t.due_at))
        .length,
      tickets.filter((t) => t.accepted_at).length,
    ),
    users: w.users.length,
    departments: w.departments.length,
    assets: w.assets.length,
    views: w.documents.reduce((n, d) => n + d.views, 0),
    month: tickets.filter(
      (t) =>
        new Date(t.created_at).getMonth() === now.getMonth() &&
        new Date(t.created_at).getFullYear() === now.getFullYear(),
    ).length,
  };
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour}h`,
    tiepNhan: tickets.filter(
      (t) =>
        new Date(t.created_at).toDateString() === now.toDateString() &&
        new Date(t.created_at).getHours() === hour,
    ).length,
    xuLy: solved.filter(
      (t) =>
        t.resolved_at &&
        new Date(t.resolved_at).toDateString() === now.toDateString() &&
        new Date(t.resolved_at).getHours() === hour,
    ).length,
  }));
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(now.getDate() - 6 + i);
    const items = tickets.filter(
      (t) => new Date(t.created_at).toDateString() === date.toDateString(),
    );
    return {
      day: date.toLocaleDateString("vi-VN", { weekday: "short" }),
      hoanThanh: items.filter((t) => completed(t.status)).length,
      dangXuLy: items.filter((t) => t.status === "Đang xử lý").length,
      moi: items.filter((t) => t.status === "Mới" || t.status === "Đã chuyển").length,
    };
  });
  const techniciansPerformance = w.users
    .filter((u) => ["technician", "helpdesk"].includes(u.role))
    .map((u) => ({
      name: u.name,
      hoanThanh: solved.filter((t) => t.assignee_id === u.id).length,
      dangXuLy: tickets.filter((t) => t.assignee_id === u.id && isOpenTicketStatus(t.status))
        .length,
    }));
  const slaTrend = monthlyTickets.map((month) => {
    const items = tickets.filter(
      (t) => `T${new Date(t.created_at).getMonth() + 1}` === month.month,
    );
    return {
      week: month.month,
      phanHoi: avg(
        items
          .filter((t) => t.accepted_at)
          .map((t) => (Date.parse(t.accepted_at!) - Date.parse(t.created_at)) / 60000),
      ),
      xuLy: avg(
        items
          .filter((t) => t.resolved_at)
          .map((t) => (Date.parse(t.resolved_at!) - Date.parse(t.created_at)) / 60000),
      ),
    };
  });
  return {
    workspace: w,
    tickets,
    monthlyTickets,
    ticketsByDepartment: group("department"),
    ticketsByCategory: group("category"),
    priorities: group("priority"),
    employees,
    departments,
    assets,
    assetsByType: Array.from(new Set(assets.map((a) => a.type))).map((name, i) => ({
      name,
      value: assets.filter((a) => a.type === name).length,
      color: colors[i % colors.length]!,
    })),
    locationUsage: Array.from(new Set(assets.map((a) => a.location))).map((label) => ({
      label: label || "Chưa ghi vị trí",
      value: pct(
        assets.filter((a) => a.location === label && a.owner_id).length,
        assets.filter((a) => a.location === label).length,
      ),
      tone: "primary" as Tone,
    })),
    software: w.software.map((s) => ({
      ...s,
      total: s.seats,
      type: s.license_type,
      expires: format(s.expires),
    })),
    documents,
    articles,
    slaTrend,
    technicianPerformance: techniciansPerformance,
    queue: tickets,
    hourly,
    channels: [{ name: "Cổng web", value: tickets.length, color: c.blue }],
    technicians,
    kbSuggestions: documents.filter((d) => d.published).map((d) => ({ ...d, match: 0 })),
    escalations: w.events
      .filter((e) => e.action === "escalate")
      .map((e) => ({
        id: e.id,
        ticketId: e.ticket_id,
        title: tickets.find((t) => t.id === e.ticket_id)?.title || e.ticket_id,
        technician: e.assignee || "—",
        time: time(e.created_at),
        status: e.to_status,
      })),
    assignments: w.events.filter((event) =>
      ["assign", "return-to-helpdesk"].includes(event.action),
    ),
    jobs,
    results,
    devices: assets,
    weekly,
    schedule: jobs
      .filter((j) => new Date(j.due_at).toDateString() === now.toDateString())
      .map((j) => ({
        id: j.id,
        time: time(j.due_at),
        title: j.title,
        place: j.location,
        tone: (j.slaRisk ? "danger" : "info") as Tone,
      })),
    workLog: w.events.map((e) => ({
      time: new Date(e.created_at).toLocaleString("vi-VN"),
      text: e.note || e.to_status,
      by: e.actor,
      ticketId: e.ticket_id,
    })),
    resultCategories: group("category", solved),
    myTickets: tickets,
    monthlyRequests: monthlyTickets.slice(-6),
    myCategories: group("category"),
    categories,
    announcements: w.notifications.map((n) => ({
      id: n.id,
      title: n.message,
      text: new Date(n.created_at).toLocaleString("vi-VN"),
      tone: "info" as const,
    })),
    timelines: Object.fromEntries(
      tickets.map((t) => [
        t.id,
        w.events
          .filter((e) => e.ticket_id === t.id)
          .reverse()
          .map((e, i, all) => ({
            id: e.id,
            label: e.to_status,
            time: new Date(e.created_at).toLocaleString("vi-VN"),
            by: e.actor,
            note: e.note,
            state: (i === all.length - 1 ? "current" : "done") as "current" | "done" | "todo",
          })),
      ]),
    ),
    feedbackHistory: tickets
      .filter((t) => t.rating)
      .map((t) => ({ ...t, rating: t.rating!, comment: t.feedback, date: format(t.closed_at) })),
    pendingFeedback: tickets.filter((t) => t.status === "Đã đóng" && t.rating === null),
    kbCategories: Array.from(
      new Set(documents.filter((d) => d.published).map((d) => d.category)),
    ).map((name) => ({
      name,
      count: documents.filter((d) => d.published && d.category === name).length,
    })),
    categorySla: group("category").map((g) => ({
      label: g.name,
      value: pct(
        tickets.filter(
          (t) =>
            t.category === g.name &&
            t.accepted_at &&
            Date.parse(t.accepted_at) <= Date.parse(t.due_at),
        ).length,
        tickets.filter((t) => t.category === g.name && t.accepted_at).length,
      ),
      tone: "primary" as Tone,
    })),
    stats,
  };
}
