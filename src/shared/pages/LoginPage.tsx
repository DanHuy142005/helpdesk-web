import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Headset,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, login, useAuth } from "../api/client";
import { PasswordField } from "../components/PasswordField";

export function LoginPage() {
  const auth = useAuth();
  useEffect(() => {
    if (auth.data) window.location.replace("/" + auth.data.user.role);
  }, [auth.data]);
  return <LoginForm />;
}

export function LoginForm() {
  const client = useQueryClient();
  const [mode, setMode] = useState<"login" | "phone" | "verify" | "reset" | "complete">("login");
  const [email, setEmail] = useState(""),
    [challenge, setChallenge] = useState("");
  const [phone, setPhone] = useState(""),
    [requestId, setRequestId] = useState("");
  const [maskedPhone, setMaskedPhone] = useState(""),
    [delivery, setDelivery] = useState("");
  const [resendAt, setResendAt] = useState(0),
    [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const busy = pending || !ready;
  function changeMode(next: typeof mode) {
    setMode(next);
    setError("");
    setChallenge("");
  }
  async function requestCode() {
    const result = await api<{ requestId: string; phone: string; delivery: string }>(
      "/auth/password/otp/request",
      {
        method: "POST",
        body: JSON.stringify({ phone }),
      },
    );
    setRequestId(result.requestId);
    setMaskedPhone(result.phone);
    setDelivery(result.delivery);
    setResendAt(Date.now() + 60000);
    setMode("verify");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      if (mode === "login") {
        const result = await login(email.trim(), String(form.get("password")));
        client.clear();
        window.location.assign("/" + result.user.role);
      } else if (mode === "phone") {
        await requestCode();
      } else if (mode === "verify") {
        const result = await api<{ challenge: string }>("/auth/password/otp/verify", {
          method: "POST",
          body: JSON.stringify({
            requestId,
            otp: form.get("otp"),
          }),
        });
        setChallenge(result.challenge);
        setMode("reset");
      } else if (mode === "reset") {
        const password = String(form.get("password")),
          confirmation = String(form.get("confirmPassword"));
        if (password !== confirmation) {
          setError("Mật khẩu nhập lại chưa khớp.");
          return;
        }
        await api("/auth/password/reset", {
          method: "POST",
          body: JSON.stringify({ challenge, password, confirmPassword: confirmation }),
        });
        setChallenge("");
        client.clear();
        setMode("complete");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể thực hiện yêu cầu. Vui lòng thử lại.",
      );
    } finally {
      setPending(false);
    }
  }
  const recovering = ["phone", "verify", "reset"].includes(mode);
  return (
    <main className="portal-admin relative flex min-h-dvh flex-col overflow-hidden px-5 py-6 sm:px-8 lg:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-48 -top-48 size-[520px] rounded-full bg-primary/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -left-48 size-[520px] rounded-full bg-cyan/10 blur-3xl"
      />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand text-white shadow-glow">
            <Headset className="size-6" />
          </span>
          <div>
            <p className="font-display text-xl font-bold tracking-tight">NexDesk</p>
            <p className="text-[11px] text-muted-foreground">IT Service Workspace</p>
          </div>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/60 px-4 py-2 text-xs font-medium text-muted-foreground sm:flex">
          <ShieldCheck className="size-4 text-primary" /> Cổng hỗ trợ nội bộ
        </span>
      </header>
      <div className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:py-14">
        <section className="hidden space-y-7 lg:block">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-white/70 px-4 py-2 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> Kết nối để làm việc tốt hơn
          </span>
          <h2 className="font-display text-[52px] font-bold leading-[1.18] tracking-tight">
            Mọi yêu cầu.
            <br />
            <span className="text-gradient">Một nơi hỗ trợ.</span>
          </h2>
          <p className="max-w-md text-base leading-7 text-muted-foreground">
            Gửi yêu cầu, kết nối với đội ngũ CNTT và theo dõi tiến độ trong một không gian làm việc
            thống nhất.
          </p>
          <div className="relative overflow-hidden rounded-[28px] border border-white bg-hero p-6 shadow-soft">
            <div className="mb-5 flex items-center gap-2 text-xs font-bold text-primary">
              <span className="size-2 rounded-full bg-primary" /> HỖ TRỢ XUYÊN SUỐT
            </div>
            <div className="grid grid-cols-3 items-start gap-3">
              {[
                { icon: Ticket, title: "Gửi yêu cầu", subtitle: "Ghi nhận vấn đề" },
                { icon: MessageCircle, title: "Cùng xử lý", subtitle: "Trao đổi trực tiếp" },
                { icon: CheckCircle2, title: "Hoàn thành", subtitle: "Xác nhận kết quả" },
              ].map(({ icon: Icon, title, subtitle }, index) => (
                <div key={title} className="relative text-center">
                  {index < 2 && (
                    <span className="absolute left-[65%] top-6 h-px w-[70%] bg-primary/15" />
                  )}
                  <span className="relative mx-auto grid size-12 place-items-center rounded-2xl border border-white bg-white/85 text-primary shadow-soft">
                    <Icon className="size-5" />
                  </span>
                  <p className="mt-3 text-xs font-bold">{title}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{subtitle}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <LockKeyhole className="size-4 text-primary" /> Thông tin của bạn được bảo vệ theo quyền
            truy cập.
          </p>
        </section>
        <section
          aria-label="Truy cập tài khoản"
          className="mx-auto w-full max-w-[460px] rounded-[28px] border border-white bg-card p-6 shadow-card sm:p-9"
        >
          {mode === "complete" ? (
            <div className="space-y-5 py-3 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-success/10 text-success">
                <CheckCircle2 className="size-8" />
              </span>
              <h1 className="font-display text-2xl font-bold">Mật khẩu đã được cập nhật</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                Đăng nhập lại bằng mật khẩu mới để tiếp tục công việc.
              </p>
              <Button variant="brand" className="h-12 w-full" onClick={() => changeMode("login")}>
                Về đăng nhập <ArrowRight />
              </Button>
            </div>
          ) : (
            <>
              <span className="mb-6 inline-flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                {recovering ? <KeyRound className="size-6" /> : <ShieldCheck className="size-6" />}
              </span>
              <p className="mb-2 text-[11px] font-bold tracking-[0.16em] text-primary">
                {recovering ? "BẢO VỆ TÀI KHOẢN" : "CHÀO MỪNG TRỞ LẠI"}
              </p>
              <h1 className="font-display text-[28px] font-bold tracking-tight">
                {mode === "login"
                  ? "Đăng nhập"
                  : mode === "phone"
                    ? "Quên mật khẩu"
                    : mode === "verify"
                      ? "Xác minh OTP"
                      : "Đặt mật khẩu mới"}
              </h1>
              <p className="mb-7 mt-2 text-sm leading-6 text-muted-foreground">
                {mode === "login"
                  ? "Tiếp tục công việc cùng NexDesk."
                  : mode === "phone"
                    ? "Nhập số điện thoại đã liên kết với tài khoản của bạn."
                    : mode === "verify"
                      ? (delivery === "sms"
                          ? "Nếu số điện thoại đã được liên kết, mã OTP đã được gửi đến "
                          : "Nhập mã OTP cho số điện thoại ") +
                        maskedPhone +
                        ". Mã có hiệu lực trong 5 phút."
                      : "Tạo mật khẩu mới gồm ít nhất 7 ký tự."}
              </p>
              {recovering && (
                <ol
                  aria-label="Các bước đổi mật khẩu"
                  className="mb-6 flex items-center gap-3 text-xs"
                >
                  <li className="flex items-center gap-2 font-semibold text-primary">
                    <span className="grid size-6 place-items-center rounded-full bg-primary-soft">
                      {mode === "reset" ? <Check className="size-3" /> : "1"}
                    </span>{" "}
                    Xác minh
                  </li>
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  <li
                    className={
                      "flex items-center gap-2 font-semibold " +
                      (mode === "reset" ? "text-primary" : "text-muted-foreground")
                    }
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-surface">
                      2
                    </span>{" "}
                    Mật khẩu mới
                  </li>
                </ol>
              )}
              <form key={mode} method="post" onSubmit={submit} className="space-y-5">
                {mode === "login" && (
                  <div className="space-y-2">
                    <label htmlFor="login-email" className="text-sm font-semibold">
                      Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      name="email"
                      autoComplete="username"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="ten@congty.vn"
                      className="field h-12"
                      disabled={busy}
                    />
                  </div>
                )}
                {mode === "login" && (
                  <>
                    <PasswordField
                      label="Mật khẩu"
                      name="password"
                      autoComplete="current-password"
                      required
                      maxLength={128}
                      placeholder="Nhập mật khẩu của bạn"
                      disabled={busy}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary hover:underline"
                        disabled={busy}
                        onClick={() => changeMode("phone")}
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                  </>
                )}
                {mode === "phone" && (
                  <div className="space-y-2">
                    <label htmlFor="recovery-phone" className="text-sm font-semibold">
                      Số điện thoại
                    </label>
                    <input
                      id="recovery-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      aria-describedby="recovery-phone-hint"
                      required
                      maxLength={40}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="field h-12"
                      placeholder="0901234567"
                      disabled={busy}
                    />
                    <p id="recovery-phone-hint" className="text-xs leading-5 text-muted-foreground">
                      Nhập số đã liên kết, dạng 0901234567 hoặc +84901234567.
                    </p>
                  </div>
                )}
                {mode === "verify" && (
                  <div className="space-y-3">
                    <label htmlFor="recovery-otp" className="text-sm font-semibold">
                      Mã OTP
                    </label>
                    <input
                      id="recovery-otp"
                      name="otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      minLength={6}
                      maxLength={6}
                      required
                      className="field h-12 text-center text-xl tracking-[0.45em]"
                      placeholder="••••••"
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary disabled:opacity-50"
                      disabled={busy || seconds > 0}
                      onClick={async () => {
                        setPending(true);
                        setError("");
                        try {
                          await requestCode();
                        } catch (caught) {
                          setError(
                            caught instanceof Error ? caught.message : "Chưa yêu cầu được mã.",
                          );
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      {seconds > 0 ? `Yêu cầu mã mới sau ${seconds}s` : "Yêu cầu mã mới"}
                    </button>
                  </div>
                )}
                {mode === "reset" && (
                  <>
                    <PasswordField
                      label="Mật khẩu mới"
                      name="password"
                      autoComplete="new-password"
                      required
                      minLength={7}
                      maxLength={128}
                      placeholder="Ít nhất 7 ký tự"
                      disabled={busy}
                    />
                    <PasswordField
                      label="Nhập lại mật khẩu mới"
                      name="confirmPassword"
                      autoComplete="new-password"
                      required
                      minLength={7}
                      maxLength={128}
                      placeholder="Nhập lại mật khẩu mới"
                      disabled={busy}
                    />
                  </>
                )}
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border border-danger/15 bg-danger/5 p-3 text-sm text-danger"
                  >
                    {error}
                  </p>
                )}
                <Button variant="brand" className="h-12 w-full text-sm" disabled={busy}>
                  {!ready
                    ? "Đang tải…"
                    : pending
                      ? "Đang xử lý…"
                      : mode === "login"
                        ? "Đăng nhập"
                        : mode === "phone"
                          ? "Yêu cầu mã OTP"
                          : mode === "verify"
                            ? "Xác minh OTP"
                            : "Lưu mật khẩu mới"}
                  <ArrowRight className="size-4" />
                </Button>
              </form>
              {recovering ? (
                <div className="mt-6 space-y-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => changeMode(mode === "phone" ? "login" : "phone")}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary"
                  >
                    <ArrowLeft className="size-3.5" />{" "}
                    {mode === "phone" ? "Quay lại đăng nhập" : "Nhập lại số điện thoại"}
                  </button>
                  {mode === "phone" && (
                    <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">
                      Nếu chưa liên kết hoặc đã đổi số điện thoại, hãy liên hệ quản trị viên để được
                      hỗ trợ.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-7 border-t pt-5 text-center text-xs leading-5 text-muted-foreground">
                  Sử dụng tài khoản được cấp bởi tổ chức của bạn.
                </p>
              )}
            </>
          )}
        </section>
      </div>
      <footer className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 text-[10px] text-muted-foreground">
        <span>© {new Date().getFullYear()} NexDesk</span>
        <span>Đồng hành cùng công việc của bạn.</span>
      </footer>
    </main>
  );
}
