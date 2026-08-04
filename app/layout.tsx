import type { Metadata } from "next";
import "./globals.css";
import AppShell from "../components/AppShell";
import PwaBridge from "../components/PwaBridge";
import AutoPushRegistration from "../components/push/AutoPushRegistration";

export const metadata: Metadata = {
  title: "PAWU",
  description: "반려동물 병원 예약과 건강관리 서비스",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "PAWU", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/pawu-v903-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/pawu-v903-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/pawu-v903-apple.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AppShell>{children}</AppShell>
        <PwaBridge />
        <AutoPushRegistration />
      </body>
    </html>
  );
}