function jsString(value: string | undefined) {
  return JSON.stringify(value ?? "");
}

export async function GET() {
  const source = `
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

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

if (
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    // notification payload가 있으면 FCM/Chrome이 자동 표시합니다.
    if (payload.notification) return;

    const title =
      payload.data?.title ||
      "PAWU 새 병원 메시지";

    return self.registration.showNotification(
      title,
      {
        body:
          payload.data?.body ||
          "병원에서 새 메시지가 도착했습니다.",
        icon: "/icons/pawu-v903-192.png",
        badge: "/icons/pawu-v903-192.png",
        tag:
          payload.data?.tag ||
          "pawu-chat-message",
        renotify: true,
        vibrate: [250, 100, 250],
        data: {
          url: payload.data?.url || "/chat",
        },
      },
    );
  });
}

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetPath =
      event.notification?.data?.url ||
      "/chat";
    const targetUrl = new URL(
      targetPath,
      self.location.origin,
    ).href;

    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then((windowClients) => {
          for (const client of windowClients) {
            if ("focus" in client) {
              client.navigate(targetUrl);
              return client.focus();
            }
          }

          return clients.openWindow(targetUrl);
        }),
    );
  },
);
`;

  return new Response(source, {
    headers: {
      "content-type":
        "application/javascript; charset=utf-8",
      "cache-control":
        "no-store, no-cache, must-revalidate",
      "service-worker-allowed": "/",
    },
  });
}
