import Link from "next/link";

export default function PolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <article className="mx-auto max-w-3xl rounded-3xl border bg-white p-8">
        <Link href="/policies" className="rounded-xl border px-4 py-2 text-sm">← 정책 목록</Link>
        <p className="mt-8 text-xs font-bold text-orange-700">출시 전 법률 전문가 검토가 필요한 서비스 초안</p>
        <h1 className="mt-2 text-3xl font-black">마케팅 수신 안내</h1>
        <p className="mt-4 text-sm leading-7 text-gray-600">이벤트와 혜택 알림에 대한 선택 동의 초안입니다.</p>
        <section className="mt-8"><h2 className="text-xl font-black">선택 동의</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">마케팅 알림은 서비스 필수 알림과 구분되며 동의하지 않아도 기본 서비스를 이용할 수 있어야 합니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">수신 항목</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">앱 푸시, 이메일, 문자 등 사용할 채널을 구분해 동의를 받아야 합니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">철회</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">알림 설정 또는 고객센터를 통해 언제든 마케팅 수신 동의를 철회할 수 있어야 합니다.</p></section>
        <footer className="mt-10 border-t pt-5 text-xs leading-6 text-gray-500">
          시행일과 사업자 정보, 개인정보 보호책임자, 문의 연락처는 법인·사업자 등록 및 출시 일정 확정 후 기입해야 합니다.
        </footer>
      </article>
    </main>
  );
}
