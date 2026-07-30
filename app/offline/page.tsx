export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f0e8] px-6 text-[#19332d]">
      <section className="w-full max-w-md rounded-[28px] border border-[#d9d4c8] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#164f43] text-2xl font-black text-white">
          P
        </div>
        <p className="text-xs font-bold tracking-[0.18em] text-[#e66a5c]">PAWU OFFLINE</p>
        <h1 className="mt-3 text-2xl font-black">인터넷 연결을 확인해 주세요</h1>
        <p className="mt-3 text-sm leading-6 text-[#65736f]">
          PAWU는 예약과 건강정보를 안전하게 불러오기 위해 인터넷 연결이 필요합니다.
        </p>
        <a
          href="/"
          className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-[#164f43] px-5 py-4 text-sm font-bold text-white"
        >
          다시 시도
        </a>
      </section>
    </main>
  );
}
