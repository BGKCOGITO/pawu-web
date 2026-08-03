"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("PAWU route error", error);
  }, [error]);

  return (
    <main className="pawu-system-state" role="alert">
      <section className="pawu-system-state-card">
        <span className="pawu-system-state-icon" aria-hidden="true">!</span>
        <p className="pawu-system-state-kicker">잠시 문제가 발생했습니다</p>
        <h1>화면을 불러오지 못했습니다.</h1>
        <p>네트워크 상태를 확인한 뒤 다시 시도해 주세요. 입력하거나 저장한 정보는 가능한 한 유지됩니다.</p>
        <div className="pawu-system-state-actions">
          <button type="button" onClick={reset}>다시 시도</button>
          <a href="/">홈으로 이동</a>
        </div>
        {error.digest ? <small>오류 번호: {error.digest}</small> : null}
      </section>
    </main>
  );
}
