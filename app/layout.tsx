import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "../components/AppShell";
import PwaBridge from "../components/PwaBridge";

export const metadata: Metadata = {
  title: {
    default: "PAWU",
    template: "%s | PAWU",
  },
  description: "반려동물 병원 예약과 건강관리 서비스",
  applicationName: "PAWU",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PAWU",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#164f43",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <PwaBridge />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}