import Link from "next/link";

export default function PolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <article className="mx-auto max-w-3xl rounded-3xl border bg-white p-8">
        <Link href="/policies" className="rounded-xl border px-4 py-2 text-sm">← 정책 목록</Link>
        <p className="mt-8 text-xs font-bold text-orange-700">출시 전 법률 전문가 검토가 필요한 서비스 초안</p>
        <h1 className="mt-2 text-3xl font-black">개인정보처리방침</h1>
        <p className="mt-4 text-sm leading-7 text-gray-600">PAWU가 처리하는 개인정보의 종류와 이용 목적을 설명하기 위한 초안입니다.</p>
        <section className="mt-8"><h2 className="text-xl font-black">처리하는 정보</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">계정 정보, 연락처, 반려동물 정보, 예약 정보, 병원 관계자 정보, 서비스 이용기록과 기기 정보가 포함될 수 있습니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">이용 목적</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">회원 식별, 예약 처리, 병원과 보호자 간 소통, 진료기록 제공, 알림 발송, 고객지원, 보안과 부정 이용 방지에 사용합니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">보관과 파기</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">법령과 서비스 운영에 필요한 기간 동안 보관하고 목적 달성 후 안전하게 파기합니다. 정확한 보관기간은 출시 전 국내 법률 검토를 거쳐 확정해야 합니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">제3자 제공과 위탁</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">병원 예약과 진료 연동을 위해 선택한 병원에 필요한 정보를 전달할 수 있습니다. 클라우드, 알림, 결제, AI 제공자를 사용할 경우 위탁 내용을 공개해야 합니다.</p></section>
        <footer className="mt-10 border-t pt-5 text-xs leading-6 text-gray-500">
          시행일과 사업자 정보, 개인정보 보호책임자, 문의 연락처는 법인·사업자 등록 및 출시 일정 확정 후 기입해야 합니다.
        </footer>
      </article>
    </main>
  );
}
