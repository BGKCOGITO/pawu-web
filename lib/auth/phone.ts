export function normalizeKoreanPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!/^01[016789]\d{7,8}$/.test(digits)) {
    throw new Error("올바른 휴대폰 번호를 입력해 주세요.");
  }

  return digits;
}

export function maskPhone(phone: string) {
  if (phone.length === 11) {
    return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
  }

  return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
}
