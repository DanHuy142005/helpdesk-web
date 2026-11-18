import { z } from "zod";

export function normalizePhone(value) {
  let phone = value
    .normalize("NFKC")
    .trim()
    .replace(/[\s().\-\u2010-\u2015]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (/^0\d{9,10}$/.test(phone)) phone = "+84" + phone.slice(1);
  else if (/^84\d{9,11}$/.test(phone)) phone = "+" + phone;
  // The national trunk zero is omitted after Vietnam's country code.
  if (/^\+840\d{9,10}$/.test(phone)) phone = "+84" + phone.slice(4);
  return phone;
}
export const phoneSchema = z
  .string()
  .max(40)
  .transform(normalizePhone)
  .refine(
    (value) => /^\+[1-9]\d{7,14}$/.test(value),
    "Số điện thoại không hợp lệ. Ví dụ: 0901234567 hoặc +84901234567.",
  );
export const optionalPhoneSchema = z
  .union([z.string().trim().length(0), phoneSchema, z.null()])
  .transform((value) => value || null);
export const maskPhone = (value) => "••••••" + value.slice(-4);
