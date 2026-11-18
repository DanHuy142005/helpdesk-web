import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, useWorkspace } from "./client";
import { LoginForm } from "../pages/LoginPage";
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
