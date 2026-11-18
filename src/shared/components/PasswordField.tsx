import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({
  label,
  ...input
}: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const generated = useId(),
    [visible, setVisible] = useState(false);
  const id = input.id || generated;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          {...input}
          id={id}
          type={visible ? "text" : "password"}
          className="field h-12 pr-12"
        />
        <button
          type="button"
          aria-label={(visible ? "Ẩn " : "Hiện ") + label.toLowerCase()}
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-1 grid w-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:text-primary"
          disabled={input.disabled}
        >
          {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      </div>
    </div>
  );
}
