import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApiUser, Workspace } from "./types";
let csrfToken = "";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (options.method && options.method !== "GET") headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch("/api" + path, { ...options, headers, credentials: "same-origin" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Không kết nối được máy chủ." }));
    if (response.status === 401 && !path.startsWith("/auth/") && typeof window !== "undefined")
      window.dispatchEvent(new Event("nexdesk:unauthorized"));
    throw new ApiError(response.status, body.error || "Yêu cầu thất bại.");
  }
  return response.json() as Promise<T>;
}
export function useAuth() {
  return useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      const result = await api<{ user: ApiUser; csrfToken: string }>("/auth/me");
      csrfToken = result.csrfToken;
      return result;
    },
    enabled: typeof window !== "undefined",
    retry: false,
    staleTime: 60000,
  });
}
export async function login(email: string, password: string) {
  const result = await api<{ user: ApiUser; csrfToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  csrfToken = result.csrfToken;
  return result;
}
export async function logout() {
  await api("/auth/logout", { method: "POST", body: "{}" });
  csrfToken = "";
}
export function useWorkspace() {
  const auth = useAuth();
  return useQuery({
    queryKey: ["workspace", auth.data?.user.id],
    queryFn: () => api<Workspace>("/workspace"),
    enabled: !!auth.data,
    refetchInterval: 3000,
    retry: 1,
  });
}
export function useWrite() {
  const client = useQueryClient();
  return async <T>(path: string, body: unknown, method = "POST"): Promise<T> => {
    try {
      const result = await api<T>(path, {
        method,
        body: body instanceof FormData ? body : JSON.stringify(body),
      });
      await client.invalidateQueries({ queryKey: ["workspace"] });
      await client.invalidateQueries({ queryKey: ["ticket"] });
      await client.invalidateQueries({ queryKey: ["document"] });
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được dữ liệu.");
      throw error;
    }
  };
}
export async function downloadReport(from = "", to = "") {
  const response = await fetch(
    "/api/reports?" + new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }),
    { credentials: "same-origin", headers: { Accept: "text/csv" } },
  );
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "nexdesk-report.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
