import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const control = isValidElement(children) ? (children as ReactElement<{ id?: string }>) : null;
  const id = control?.props.id || generatedId;
  return (
    <div className="block space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {control ? cloneElement(control, { id }) : children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
