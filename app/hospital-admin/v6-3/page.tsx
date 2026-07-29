import Link from "next/link";

const menus = [
  ["/hospital-admin/workflow-v6-2", "오늘의 통합 업무", "예약부터 진료 완료까지 한 화면에서 처리합니다."],
  ["/hospital-admin/emr", "전자차트", "환자별 SOAP 진료기록, 진단, 처치와 처방을 관리합니다."],
  ["/hospital-admin/emr/new", "새 전자차트", "예약 없이 방문한 환자도 전자차트를 생성합니다."],
  ["/hospital-admin/billing/new", "간편 청구서", "진료 항목을 바탕으로 청구서를 작성합니다."],
  ["/hospital-admin/inventory/usage-review", "재고 사용량 검토", "진료 후 실제 재고 사용량을 확인합니다."],
  ["/hospital-admin/inventory", "재고 관리", "현재 수량과 입출고 이력을 관리합니다."],
  ["/hospital-admin/patients", "환자 관리", "환자 기본 정보와 누적 이력을 확인합니다."],
  ["/hospital-admin/analytics", "운영 통계", "예약·청구·운영 현황을 확인합니다."],
];

export default function HospitalV63Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-7xl">
        <Link href="/hospital-admin/v6-2" className="rounded-xl border bg-white px-4 py-2 text-sm">
          ← V6.2 대시보드
        </Link>

        <header className="mt-8 rounded-[2rem] bg-black p-8 text-white">
          <p className="text-sm text-gray-300">PAWU HOSPITAL V6.3</p>
          <h1 className="mt-2 text-3xl font-black">전자차트·진료기록 시스템</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
            병원은 SOAP 차트, 진단, 처치, 처방과 재진 계획을 기록하고,
            보호자는 병원이 공개한 요약과 복약·재진 안내를 PAWU에서 확인합니다.
          </p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {menus.map(([href, title, description]) => (
            <Link key={href} href={href} className="rounded-3xl border bg-white p-5 transition hover:border-black">
              <h2 className="text-lg font-black">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
            </Link>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border bg-white p-6">
          <h2 className="text-xl font-black">V6.3 데이터 흐름</h2>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            예약 문진 → 전자차트 작성 → 진단·처치·처방 → 청구 → 재고 검토 → 차트 확정 → 보호자 진료기록·복약·재진 안내
          </p>
        </section>
      </div>
    </main>
  );
}
