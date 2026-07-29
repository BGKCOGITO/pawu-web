import Link from "next/link";

const menus = [
  ["/hospital-admin/workflow-v6-2", "오늘의 통합 업무", "예약 승인부터 진료·청구·결제·재고 확정까지 한 화면에서 처리합니다."],
  ["/hospital-admin/inventory/usage-review", "재고 검토 대기", "재고 사용량을 검토해야 하는 청구서를 바로 확인합니다."],
  ["/hospital-admin/billing/new", "간편 청구서", "진료 항목을 선택해 청구서를 빠르게 작성합니다."],
  ["/hospital-admin/inventory/service-mappings", "진료–재고 연결", "진료 항목별 기본 재고 사용량을 설정합니다."],
  ["/hospital-admin/inventory", "재고 관리", "수량, 부족 재고, 유효기간과 입출고 이력을 확인합니다."],
  ["/hospital-admin/patients", "환자 차트", "환자별 진료 기록과 이전 방문 정보를 확인합니다."],
  ["/hospital-admin/staff", "직원 관리", "업무별 조회·수정·확정 권한을 관리합니다."],
  ["/hospital-admin/analytics", "운영 통계", "예약, 청구와 병원 운영 현황을 확인합니다."],
];

export default function HospitalV62Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-7xl">
        <Link href="/hospital-admin/v6-1" className="rounded-xl border bg-white px-4 py-2 text-sm">
          ← V6.1 대시보드
        </Link>

        <header className="mt-8 rounded-[2rem] bg-black p-8 text-white">
          <p className="text-sm text-gray-300">PAWU HOSPITAL V6.2</p>
          <h1 className="mt-2 text-3xl font-black">통합 진료 업무 흐름</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
            직원이 주소나 청구서 번호를 직접 입력하지 않고, 오늘의 환자 목록에서 필요한 업무 버튼만 눌러 다음 단계로 이동합니다.
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
          <h2 className="text-xl font-black">V6.2 업무 흐름</h2>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            예약 승인 → 접수 → 진료 시작 → 청구서 작성 → 결제 요청 → 재고 사용량 검토 → 재고 차감 확정 → 진료 완료
          </p>
        </section>
      </div>
    </main>
  );
}
