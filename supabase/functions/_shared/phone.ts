export function normalizeKoreanPhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("82")) {
    const local = `0${digits.slice(2)}`;
    return /^01[016789]\d{7,8}$/.test(local) ? local : null;
  }

  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

export function getRequestIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || null;
}
