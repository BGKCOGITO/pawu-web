import Link from "next/link";

export default function PolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <article className="mx-auto max-w-3xl rounded-3xl border bg-white p-8">
        <Link href="/policies" className="rounded-xl border px-4 py-2 text-sm">← 정책 목록</Link>
        <p className="mt-8 text-xs font-bold text-orange-700">출시 전 법률 전문가 검토가 필요한 서비스 초안</p>
        <h1 className="mt-2 text-3xl font-black">AI 이용 및 안전 안내</h1>
        <p className="mt-4 text-sm leading-7 text-gray-600">PAWU AI 기능의 역할과 한계를 설명하는 초안입니다.</p>
        <section className="mt-8"><h2 className="text-xl font-black">AI의 역할</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">증상을 정리하고 병원 상담 준비를 돕거나 병원이 입력한 진료기록을 쉬운 문장으로 재구성합니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">제공하지 않는 것</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">확정 진단, 처방, 투약량 결정, 수술 여부 판단, 응급 처치를 대신하지 않습니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">응급 상황</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">호흡곤란, 의식 저하, 경련, 대량 출혈, 중독 의심 등은 AI 답변을 기다리지 말고 즉시 가까운 동물병원에 연락해야 합니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">검토와 개선</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">AI 결과는 오류가 있을 수 있으며 의료 안전 검토, 사용자 신고, 감사로그를 바탕으로 지속적으로 개선해야 합니다.</p></section>
        <footer className="mt-10 border-t pt-5 text-xs leading-6 text-gray-500">
          시행일과 사업자 정보, 개인정보 보호책임자, 문의 연락처는 법인·사업자 등록 및 출시 일정 확정 후 기입해야 합니다.
        </footer>
      </article>
    </main>
  );
}
