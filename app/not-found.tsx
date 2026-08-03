export default function NotFoundPage() {
  return (
    <main className="pawu-system-state">
      <section className="pawu-system-state-card">
        <span className="pawu-system-state-icon" aria-hidden="true">404</span>
        <p className="pawu-system-state-kicker">페이지를 찾을 수 없습니다</p>
        <h1>요청한 화면이 없거나 이동되었습니다.</h1>
        <p>주소를 다시 확인하거나 PAWU 홈에서 필요한 메뉴로 이동해 주세요.</p>
        <div className="pawu-system-state-actions">
          <a href="/">홈으로 이동</a>
        </div>
      </section>
    </main>
  );
}
