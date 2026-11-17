import type { TicketPriority, TicketStatus } from "../lib/ticket";
export type Role = "admin" | "helpdesk" | "technician" | "end-user";
export interface ApiUser {
  id: string;
  code: string;
  name: string;
  email: string;
  role: Role;
  department_id?: string | null;
  departmentId?: string | null;
  department?: string;
  position: string;
  active: boolean;
  devices?: number;
}
export interface ApiTicket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  requester_id: string;
  requester: string;
  email: string;
  department: string | null;
  assignee_id: string | null;
  assignee: string | null;
  asset_id: string | null;
  asset_name: string | null;
  location: string | null;
  solution: string;
  due_at: string;
  accepted_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  rating: number | null;
  feedback: string;
  version: number;
  created_at: string;
  updated_at: string;
  comment_count: number;
}
export interface ApiAsset {
  id: string;
  name: string;
  type: string;
  serial: string | null;
  location: string;
  warranty: string | null;
  notes: string;
  status: "Trong kho" | "Đang sử dụng" | "Bảo trì" | "Thanh lý";
  specs: { cpu?: string; ram?: string; storage?: string; os?: string; health?: number };
  owner: string | null;
  owner_id: string | null;
  department: string | null;
  version: number;
}
export interface ApiDepartment {
  id: string;
  name: string;
  head: string;
  staff: number;
  open_tickets: number;
  assets: number;
  satisfaction: number | null;
}
export interface ApiSoftware {
  id: string;
  name: string;
  vendor: string;
  version: string;
  license_type: "Thuê bao" | "Vĩnh viễn" | "Mã nguồn mở";
  seats: number;
  used: number;
  expires: string | null;
  installations: string[];
}
export interface ApiDocument {
  id: string;
  title: string;
  category: string;
  content: string;
  visibility: "public" | "internal";
  published: boolean;
  author_id: string;
  views: number;
  updated_at: string;
  owner: string;
  bytes: number;
}
export interface ApiEvent {
  id: string;
  ticket_id: string;
  actor: string;
  action: string;
  note: string;
  from_status: TicketStatus | null;
  to_status: TicketStatus;
  assignee: string | null;
  created_at: string;
}
export interface ApiComment {
  id: string;
  body: string;
  internal: boolean;
  created_at: string;
  author: string;
  author_id: string;
}
export interface ApiAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
}
export interface TicketDetail extends ApiTicket {
  comments: ApiComment[];
  events: ApiEvent[];
  attachments: ApiAttachment[];
}
export interface Workspace {
  user: ApiUser;
  tickets: ApiTicket[];
  users: ApiUser[];
  departments: ApiDepartment[];
  assets: ApiAsset[];
  software: ApiSoftware[];
  documents: ApiDocument[];
  notifications: {
    id: string;
    message: string;
    ticket_id: string | null;
    read_at: string | null;
    created_at: string;
  }[];
  audits: {
    id: string;
    actor: string | null;
    action: string;
    entity: string;
    entity_id: string;
    details: Record<string, unknown>;
    created_at: string;
  }[];
  events: ApiEvent[];
  serverTime: string;
}
export type Entity = "users" | "departments" | "assets" | "software" | "documents";
