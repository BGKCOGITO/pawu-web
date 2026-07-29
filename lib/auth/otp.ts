import crypto from "node:crypto";

const OTP_COOKIE_NAME = "pawu_phone_verification";

type VerificationPayload = {
  phone: string;
  verificationId: string;
  expiresAt: number;
};

function requireSecret(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} 환경변수가 필요합니다.`);
  }

  return value;
}

export function createOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashOtp(params: {
  verificationId: string;
  phone: string;
  code: string;
}) {
  const pepper = requireSecret("PAWU_OTP_PEPPER");

  return crypto
    .createHmac("sha256", pepper)
    .update(
      `${params.verificationId}:${params.phone}:${params.code}`,
      "utf8",
    )
    .digest("hex");
}

export function safeEqualHex(left: string, right: string) {
  if (
    left.length !== right.length ||
    !/^[a-f0-9]+$/i.test(left) ||
    !/^[a-f0-9]+$/i.test(right)
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(left, "hex"),
    Buffer.from(right, "hex"),
  );
}

function signPayload(encodedPayload: string) {
  const secret = requireSecret("PAWU_PHONE_VERIFICATION_SECRET");

  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload, "utf8")
    .digest("base64url");
}

export function createVerificationToken(
  payload: VerificationPayload,
) {
  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8",
  ).toString("base64url");

  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyVerificationToken(
  token: string | undefined,
): VerificationPayload | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = signPayload(encodedPayload);

  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    )
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as VerificationPayload;

    if (
      !payload.phone ||
      !payload.verificationId ||
      !payload.expiresAt ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export { OTP_COOKIE_NAME };
