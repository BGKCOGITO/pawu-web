import { NextRequest, NextResponse } from "next/server";

const HOSPITAL_HOST = "pawu-hospital-web.vercel.app";
const GUARDIAN_HOST = "pawu-web.vercel.app";

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/.well-known/")
  );
}

export function proxy(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase();
  const pathname = request.nextUrl.pathname;

  if (isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const hospitalHost =
    hostname === HOSPITAL_HOST ||
    hostname.startsWith("hospital.") ||
    hostname.includes("pawu-hospital");

  if (hospitalHost) {
    const allowed =
      pathname.startsWith("/hospital-admin") ||
      pathname.startsWith("/auth/hospital-login") ||
      pathname.startsWith("/auth/callback");

    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/hospital-admin";
      url.search = "";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  if (
    hostname === GUARDIAN_HOST &&
    (
      pathname.startsWith("/hospital-admin") ||
      pathname.startsWith("/auth/hospital-login")
    )
  ) {
    const url = request.nextUrl.clone();
    url.hostname = HOSPITAL_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
