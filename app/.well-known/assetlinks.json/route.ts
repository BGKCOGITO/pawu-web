import { NextResponse } from "next/server";

const assetLinks = [
  {
    relation: [
      "delegate_permission/common.handle_all_urls",
    ],
    target: {
      namespace: "android_app",
      package_name: "kr.co.bgkcogito.pawu",
      sha256_cert_fingerprints: [
        "A9:6D:E9:61:E0:C5:9C:7A:38:1D:0E:8F:02:92:50:0B:A9:2A:24:5D:56:8A:BC:46:65:94:B6:E6:31:85:F3:3F",
      ],
    },
  },
];

export async function GET() {
  return NextResponse.json(assetLinks, {
    headers: {
      "Cache-Control": "public, max-age=300, must-revalidate",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
