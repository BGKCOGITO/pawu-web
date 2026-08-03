export default function Loading() {
  return (
    <main className="pawu-route-loading" aria-live="polite" aria-label="화면 불러오는 중">
      <div className="pawu-route-loading-head">
        <span className="pawu-skeleton pawu-skeleton-kicker" />
        <span className="pawu-skeleton pawu-skeleton-title" />
        <span className="pawu-skeleton pawu-skeleton-copy" />
      </div>
      <div className="pawu-route-loading-grid">
        <span className="pawu-skeleton pawu-skeleton-card" />
        <span className="pawu-skeleton pawu-skeleton-card" />
        <span className="pawu-skeleton pawu-skeleton-card" />
      </div>
    </main>
  );
}
