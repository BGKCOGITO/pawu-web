import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function fingerprints() {
  return (process.env.ANDROID_TWA_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

export async function GET() {
  const sha256CertFingerprints = fingerprints();

  return NextResponse.json(
    sha256CertFingerprints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: "kr.co.bgkcogito.pawu",
              sha256_cert_fingerprints: sha256CertFingerprints,
            },
          },
        ]
      : [],
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
