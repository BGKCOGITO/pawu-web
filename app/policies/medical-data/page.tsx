import Link from "next/link";

export default function PolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <article className="mx-auto max-w-3xl rounded-3xl border bg-white p-8">
        <Link href="/policies" className="rounded-xl border px-4 py-2 text-sm">← 정책 목록</Link>
        <p className="mt-8 text-xs font-bold text-orange-700">출시 전 법률 전문가 검토가 필요한 서비스 초안</p>
        <h1 className="mt-2 text-3xl font-black">의료정보 처리 안내</h1>
        <p className="mt-4 text-sm leading-7 text-gray-600">진료기록과 첨부파일이 PAWU에서 처리되는 방식에 대한 초안입니다.</p>
        <section className="mt-8"><h2 className="text-xl font-black">기록의 작성 주체</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">진료기록은 병원 관계자가 작성하며 PAWU는 입력과 열람을 위한 기술적 수단을 제공합니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">보호자 열람</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">보호자는 본인 계정과 연결된 반려동물의 기록을 열람할 수 있습니다. 병원 내부 기록 중 법령이나 병원 정책상 제공이 제한되는 정보는 별도 구분이 필요합니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">보안</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">접근권한, 감사로그, 암호화, 비공개 파일 저장소, 서명 URL, 보존기간 정책을 적용해야 합니다. V4 개발본은 일부 구조만 제공하므로 출시 전 보안 강화가 필수입니다.</p></section>
<section className="mt-8"><h2 className="text-xl font-black">정정과 삭제</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">의료기록 정정과 삭제는 법령 및 병원의 기록 보존 의무를 우선하며 단순 회원 요청만으로 원본 기록이 즉시 삭제되지 않을 수 있습니다.</p></section>
        <footer className="mt-10 border-t pt-5 text-xs leading-6 text-gray-500">
          시행일과 사업자 정보, 개인정보 보호책임자, 문의 연락처는 법인·사업자 등록 및 출시 일정 확정 후 기입해야 합니다.
        </footer>
      </article>
    </main>
  );
}
