/** Semantic color "tones" shared by badges, icons and KPI accents. */
export type Tone = "primary" | "success" | "warning" | "info" | "danger" | "lavender" | "cyan" | "muted";

export const toneSoft: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/10 text-info",
  danger: "bg-danger/10 text-danger",
  lavender: "bg-lavender/15 text-lavender",
  cyan: "bg-cyan/20 text-info",
  muted: "bg-muted text-muted-foreground",
};

export const toneDot: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  danger: "bg-danger",
  lavender: "bg-lavender",
  cyan: "bg-cyan",
  muted: "bg-muted-foreground",
};

export const toneBar: Record<Tone, string> = {
  primary: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  danger: "bg-danger",
  lavender: "bg-lavender",
  cyan: "bg-cyan",
  muted: "bg-muted-foreground",
};
