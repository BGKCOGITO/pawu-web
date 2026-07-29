import Link from "next/link";

export default function PolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <article className="mx-auto max-w-3xl rounded-3xl border bg-white p-8">
        <Link href="/policies" className="rounded-xl border px-4 py-2 text-sm">← 정책 목록</Link>
        <p className="mt-8 text-xs font-bold text-orange-700">출시 전 법률 전문가 검토가 필요한 서비스 초안</p>
        <h1 className="mt-2 text-3xl font-black">서비스 이용약관</h1>
        <p className="mt-4 text-sm leading-7 text-gray-600">PAWU 서비스 이용 관계와 책임 범위를 정의하기 위한 초안입니다.</p>
        <section className="mt-8"><h2 className="text-xl font-black">서비스 범위</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">병원 검색, 예약, 반려동물 프로필, 건강수첩, 병원 채팅, 정보 정리형 AI 기능을 제공합니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">의료행위 구분</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">PAWU는 동물병원 검색과 정보 전달을 돕는 플랫폼이며 직접 진료하거나 수의학적 진단과 처방을 제공하지 않습니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">회원의 책임</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">회원은 정확한 정보를 제공하고 계정과 인증수단을 안전하게 관리해야 합니다. 타인의 의료정보나 계정을 무단으로 사용해서는 안 됩니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">서비스 제한</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">불법 이용, 괴롭힘, 의료정보 오남용, 보안 위협이 확인되면 이용을 제한하거나 계정을 정지할 수 있습니다.</p></section>
        <footer className="mt-10 border-t pt-5 text-xs leading-6 text-gray-500">
          시행일과 사업자 정보, 개인정보 보호책임자, 문의 연락처는 법인·사업자 등록 및 출시 일정 확정 후 기입해야 합니다.
        </footer>
      </article>
    </main>
  );
}
