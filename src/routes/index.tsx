import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/shared";
import { LoginPage } from "@/shared/pages/LoginPage";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Đăng nhập · NexDesk",
      "Đăng nhập tài khoản NexDesk để gửi yêu cầu và quản lý công việc hỗ trợ CNTT.",
    ),
  component: LoginPage,
});
