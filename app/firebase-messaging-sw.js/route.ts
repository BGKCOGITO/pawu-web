function jsString(value: string | undefined) {
  return JSON.stringify(value ?? "");
}

export async function GET() {
  const source = `
const CACHE_NAME = "pawu-shell-v9.7.0";
const OFFLINE_URL = "/offline";
const APP_SHELL = [OFFLINE_URL, "/icons/pawu-v903-192.png", "/icons/pawu-v903-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      }))
    );
  }
});

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: ${jsString(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)},
  authDomain: ${jsString(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)},
  projectId: ${jsString(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)},
  storageBucket: ${jsString(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)},
  messagingSenderId: ${jsString(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)},
  appId: ${jsString(process.env.NEXT_PUBLIC_FIREBASE_APP_ID)}
};

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    // notification payload는 FCM/브라우저가 앱 종료 상태에서도 직접 표시한다.
    // 여기서 다시 showNotification을 호출하면 동일 알림이 두 번 보일 수 있으므로 건너뛴다.
    if (payload.notification) return;

    // 구버전 data-only 메시지와 개발 테스트 메시지만 수동 표시한다.
    const title = payload.data?.title || "PAWU 새 병원 메시지";
    const options = {
      body: payload.data?.body || "병원에서 새 메시지가 도착했습니다.",
      icon: "/icons/pawu-v903-192.png",
      badge: "/icons/pawu-v903-192.png",
      tag: payload.data?.tag || "pawu-chat-message",
      renotify: true,
      vibrate: [250, 100, 250],
      data: { url: payload.data?.url || "/chat" }
    };
    return self.registration.showNotification(title, options);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = event.notification?.data?.url || "/chat";
  const targetUrl = new URL(targetPath, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
`;

  return new Response(source, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "service-worker-allowed": "/",
    },
  });
}
