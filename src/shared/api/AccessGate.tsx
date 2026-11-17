import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { login, useAuth, useWorkspace } from "./client";
import type { Role } from "./types";
import { ActionsProvider } from "./Actions";

export function AccessGate({ role, children }: { role: Role; children: ReactNode }) {
  const auth = useAuth(),
    workspace = useWorkspace(),
    client = useQueryClient();
  useEffect(() => {
    const invalidate = () => {
      void client.cancelQueries();
      client.removeQueries({ queryKey: ["workspace"] });
      client.setQueryData(["auth"], null);
    };
    window.addEventListener("nexdesk:unauthorized", invalidate);
    return () => window.removeEventListener("nexdesk:unauthorized", invalidate);
  }, [client]);
  useEffect(() => {
    if (auth.data && workspace.data && auth.data.user.id !== workspace.data.user.id)
      void client.invalidateQueries({ queryKey: ["auth"] });
  }, [auth.data?.user.id, workspace.data?.user.id, client]);
  if (auth.isPending) return <Loading />;
  if (!auth.data) return <LoginForm />;
  const currentUser = workspace.data?.user || auth.data.user;
  if (currentUser.role !== role)
    return (
      <div className="mx-auto mt-24 max-w-xl card-surface p-8 text-center">
        <ShieldCheck className="mx-auto mb-4 size-10 text-primary" />
        <h1 className="text-xl font-bold">Bạn không có quyền vào cổng này</h1>
        <p className="my-4 text-muted-foreground">Tài khoản hiện tại: {currentUser.name}</p>
        <Button variant="brand" asChild>
          <a href={"/" + currentUser.role}>Mở cổng của tôi</a>
        </Button>
      </div>
    );
  if (workspace.isPending) return <Loading />;
  if (workspace.error || !workspace.data)
    return (
      <div className="mx-auto mt-24 max-w-xl card-surface p-8 text-center">
        <h1 className="text-xl font-bold">Chưa tải được dữ liệu</h1>
        <p className="my-4 text-muted-foreground">{workspace.error?.message}</p>
        <Button onClick={() => void workspace.refetch()}>Thử lại</Button>
      </div>
    );
  return <ActionsProvider>{children}</ActionsProvider>;
}
function Loading() {
  return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      Đang tải hệ thống…
    </div>
  );
}
export function LoginForm() {
  const client = useQueryClient();
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <main className="portal-admin grid min-h-screen place-items-center bg-hero px-4">
      <section className="card-surface w-full max-w-md p-8 shadow-card">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand text-white">
            <ShieldCheck />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold">NexDesk</h1>
            <p className="text-sm text-muted-foreground">IT Helpdesk doanh nghiệp</p>
          </div>
        </div>
        <h2 className="mb-5 text-xl font-bold">Đăng nhập</h2>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setPending(true);
            setError("");
            try {
              const result = await login(String(form.get("email")), String(form.get("password")));
              client.clear();
              client.setQueryData(["auth"], result);
              window.location.assign("/" + result.user.role);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="block text-sm font-semibold">
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="field mt-2"
            />
          </label>
          <label className="block text-sm font-semibold">
            Mật khẩu
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              className="field mt-2"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="brand" className="w-full" disabled={pending}>
            <LogIn />
            {pending ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
        </form>
        <a href="/" className="mt-5 block text-center text-sm text-primary">
          Danh sách cổng làm việc
        </a>
      </section>
    </main>
  );
}
