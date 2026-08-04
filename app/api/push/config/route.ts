import { NextResponse } from "next/server";
import {
  getFirebaseAdminProjectId,
  isFirebaseAdminConfigured,
} from "../../../../lib/push/fcm-admin";

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "",
  };

  const requiredClientValues = [
    ["NEXT_PUBLIC_FIREBASE_API_KEY", config.apiKey],
    ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", config.projectId],
    ["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", config.messagingSenderId],
    ["NEXT_PUBLIC_FIREBASE_APP_ID", config.appId],
    ["NEXT_PUBLIC_FIREBASE_VAPID_KEY", config.vapidKey],
  ] as const;
  const missingClientEnv = requiredClientValues.filter(([, value]) => !value).map(([name]) => name);
  const clientReady = missingClientEnv.length === 0;
  const serverReady = isFirebaseAdminConfigured();
  const serverProjectId = getFirebaseAdminProjectId();
  const clientProjectId = config.projectId;
  const projectMatch = Boolean(
    serverProjectId &&
      clientProjectId &&
      serverProjectId === clientProjectId,
  );

  return NextResponse.json({
    ok: true,
    ready: clientReady && serverReady,
    clientReady,
    serverReady,
    missingClientEnv,
    missingServerEnv: serverReady
      ? []
      : ["FIREBASE_SERVICE_ACCOUNT_JSON"],
    clientProjectId,
    serverProjectId,
    projectMatch,
    config,
  });
}
