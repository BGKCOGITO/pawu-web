"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ko">
      <body>
        <main className="pawu-system-state" role="alert">
          <section className="pawu-system-state-card">
            <span className="pawu-system-state-icon" aria-hidden="true">!</span>
            <p className="pawu-system-state-kicker">PAWU를 다시 불러와 주세요</p>
            <h1>앱 실행 중 문제가 발생했습니다.</h1>
            <p>잠시 후 다시 시도하거나 앱을 완전히 종료한 뒤 다시 실행해 주세요.</p>
            <div className="pawu-system-state-actions">
              <button type="button" onClick={reset}>다시 시도</button>
              <a href="/">홈으로 이동</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
