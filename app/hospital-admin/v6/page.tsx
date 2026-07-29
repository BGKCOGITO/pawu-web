import Link from "next/link";

const cards = [
  ["/hospital-admin/inventory", "재고 대시보드", "현재 수량, 안전 재고, 부족 품목, 유효기간 임박 로트를 확인합니다."],
  ["/hospital-admin/inventory/new", "재고 품목 등록", "의약품, 백신, 소독제, 소모품과 판매 제품을 등록합니다."],
  ["/hospital-admin/inventory/movement", "입출고 처리", "입고, 진료 사용, 폐기, 반품과 수량 조정을 기록합니다."],
  ["/hospital-admin/billing/catalog", "진료 항목", "병원별 진료 항목과 기본 금액을 관리합니다."],
  ["/hospital-admin/billing/new", "간편 청구서", "진료 항목을 체크해 청구서를 빠르게 만듭니다."],
  ["/hospital-admin/v5", "V5 기능", "회원 구조와 결제 요청 기능을 확인합니다."],
];

export default function HospitalV6Page() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-6xl">
        <Link href="/hospital-admin/v5" className="rounded-xl border bg-white px-4 py-2 text-sm">← V5 대시보드</Link>
        <header className="mt-8 rounded-[2rem] bg-black p-8 text-white">
          <p className="text-sm text-gray-300">PAWU HOSPITAL V6</p>
          <h1 className="mt-2 text-3xl font-black">병원 재고 운영 시스템</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
            병원 품목, 현재 수량, 안전 재고, 유효기간, 로트와 모든 입출고 이력을 한곳에서 관리합니다.
          </p>
        </header>
        <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map(([href, title, description]) => (
            <Link key={href} href={href} className="rounded-3xl border bg-white p-6 transition hover:border-black">
              <h2 className="text-xl font-black">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{description}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
