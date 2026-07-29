import Link from "next/link";

const menus = [
  ["/hospital-admin/workflow-v6-2", "오늘의 통합 업무", "예약부터 진료 완료까지 관리합니다."],
  ["/hospital-admin/emr", "전자차트", "SOAP, 진단, 처치와 처방을 기록합니다."],
  ["/hospital-admin/lab", "검사·영상 관리", "혈액검사, X-ray, 초음파와 외부검사 결과를 관리합니다."],
  ["/hospital-admin/lab/new", "새 검사 지시", "환자와 전자차트에 검사 주문을 연결합니다."],
  ["/hospital-admin/billing/new", "간편 청구서", "진료·검사 항목을 청구서로 연결합니다."],
  ["/hospital-admin/inventory/usage-review", "재고 검토", "검사·처치 후 실제 사용 재고를 확인합니다."],
  ["/hospital-admin/patients", "환자 관리", "환자별 누적 진료와 검사 이력을 확인합니다."],
  ["/hospital-admin/analytics", "운영 통계", "예약, 청구와 검사 업무량을 확인합니다."],
];

export default function HospitalV64Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-7xl">
        <Link href="/hospital-admin/v6-3" className="rounded-xl border bg-white px-4 py-2 text-sm">← V6.3 대시보드</Link>

        <header className="mt-8 rounded-[2rem] bg-black p-8 text-white">
          <p className="text-sm text-gray-300">PAWU HOSPITAL V6.4</p>
          <h1 className="mt-2 text-3xl font-black">검사·영상 결과 시스템</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
            검사 지시, 검체 채취, 결과 수치, 영상·PDF, 병원 판독과 보호자 공개 설명을 전자차트에 연결합니다.
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
          <h2 className="text-xl font-black">V6.4 데이터 흐름</h2>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            전자차트 → 검사 지시 → 검체 채취·검사 중 → 수치·영상·PDF 등록 → 병원 판독 → 결과 확정 → 보호자 앱 공개
          </p>
        </section>
      </div>
    </main>
  );
}
