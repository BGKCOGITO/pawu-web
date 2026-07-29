import Link from "next/link";

export default function HospitalV3HubPage() {
  const cards = [
    ["/hospital-admin/chat", "보호자 채팅", "예약 환자와 사진·영상·파일을 주고받습니다."],
    ["/hospital-admin/ai-summary", "진료기록 요약", "병원 기록을 보호자 친화적인 문장으로 정리합니다."],
    ["/hospital-admin/workflow", "오늘 업무 보드", "접수 → 진료 → 결제 대기 → 완료 흐름을 관리합니다."],
    ["/hospital-admin/medical-records", "진료기록", "진단·처방·검사·재진일을 기록합니다."],
    ["/hospital-admin/patients", "환자 EMR", "전체 진료·검사·수술·체중 이력을 확인합니다."],
    ["/hospital-admin/staff", "직원 권한", "원장·수의사·간호·접수 권한을 관리합니다."],
  ];

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-6xl">
        <Link href="/hospital-admin" className="rounded-xl border bg-white px-4 py-2 text-sm">← 기존 병원관리자</Link>
        <header className="mt-8 rounded-3xl bg-black p-8 text-white">
          <p className="text-sm text-gray-300">PAWU Hospital System V3</p>
          <h1 className="mt-2 text-3xl font-black">Communication & AI</h1>
          <p className="mt-3 text-sm text-gray-300">병원과 보호자를 연결하는 채팅·기록 요약 통합 화면입니다.</p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map(([href, title, description]) => (
            <Link key={href} href={href} className="rounded-3xl border bg-white p-6 transition hover:border-black">
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{description}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
