"use client";

import { useEffect, useState } from "react";

export default function NetworkStatusBanner() {
  const [online, setOnline] = useState(true);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const updateOnlineState = () => {
      const nextOnline = navigator.onLine;
      setOnline((previousOnline) => {
        if (!previousOnline && nextOnline) {
          setRestored(true);
          window.setTimeout(() => setRestored(false), 2_500);
        }
        return nextOnline;
      });
    };

    setOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  if (!online) {
    return (
      <div className="pawu-network-banner pawu-network-banner-offline" role="status" aria-live="polite">
        인터넷 연결이 끊겼습니다. 연결되면 자동으로 다시 사용할 수 있습니다.
      </div>
    );
  }

  if (restored) {
    return (
      <div className="pawu-network-banner pawu-network-banner-online" role="status" aria-live="polite">
        인터넷 연결이 복구되었습니다.
      </div>
    );
  }

  return null;
}
