import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PAWU",
    short_name: "PAWU",
    description: "반려동물 병원 예약과 건강관리 서비스",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "portrait-primary",
    background_color: "#f4f0e8",
    theme_color: "#174f45",
    lang: "ko-KR",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      { src: "/icons/pawu-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pawu-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/pawu-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/pawu-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "병원 찾기", short_name: "병원 찾기", url: "/map", icons: [{ src: "/icons/pawu-192.png", sizes: "192x192" }] },
      { name: "예약 조회", short_name: "예약", url: "/my-reservations", icons: [{ src: "/icons/pawu-192.png", sizes: "192x192" }] },
    ],
  };
}
