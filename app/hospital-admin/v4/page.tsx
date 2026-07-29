import Link from "next/link";

const cards = [
  ["/hospital-admin/workflow", "오늘 업무", "접수부터 진료 완료까지 한 화면에서 관리합니다."],
  ["/hospital-admin/chat", "보호자 채팅", "예약 환자와 사진·파일을 포함해 대화합니다."],
  ["/hospital-admin/patients", "환자 EMR", "진료, 검사, 수술, 체중, 첨부파일을 확인합니다."],
  ["/hospital-admin/medical-records", "진료기록 작성", "진단, 처방, 복약, 재진 정보를 기록합니다."],
  ["/hospital-admin/analytics", "운영 통계", "예약, 완료율, 취소율, 재방문 흐름을 확인합니다."],
  ["/hospital-admin/staff", "직원 권한", "원장, 수의사, 간호, 접수 권한을 관리합니다."],
  ["/hospital-admin/ai-summary", "기록 요약", "병원 기록을 보호자용 문장으로 정리합니다."],
  ["/hospital-admin/audit-logs", "활동 기록", "병원 계정의 주요 변경 이력을 확인합니다."],
];

export default function HospitalV4Page() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-6xl">
        <Link href="/hospital-admin" className="rounded-xl border bg-white px-4 py-2 text-sm">← 기존 병원관리자</Link>
        <header className="mt-8 rounded-[2rem] bg-black p-8 text-white">
          <p className="text-sm text-gray-300">PAWU PLATFORM V4</p>
          <h1 className="mt-2 text-3xl font-black">병원 운영 대시보드</h1>
          <p className="mt-3 text-sm text-gray-300">예약, EMR, 채팅, 직원, 통계를 병원 업무 기준으로 묶었습니다.</p>
        </header>
        <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map(([href, title, description]) => (
            <Link key={href} href={href} className="rounded-3xl border bg-white p-6 transition hover:border-black">
              <h2 className="text-lg font-black">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{description}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
