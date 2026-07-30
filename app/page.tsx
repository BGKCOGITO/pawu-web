import Link from "next/link";
import HomeRoleRedirect from "@/components/HomeRoleRedirect";
import HomeCareSummary from "@/components/home/HomeCareSummary";
import MyHospitalHomeCard from "@/components/guardian/MyHospitalHomeCard";

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
    record: <><path d="M8 3h8l3 3v15H5V3h3Z"/><path d="M14 3v5h5M8 13h8M8 17h6"/></>,
    pill: <><path d="m8.5 15.5 7-7a4.24 4.24 0 0 1 6 6l-7 7a4.24 4.24 0 0 1-6-6Z"/><path d="m12 12 6 6"/></>,
    spark: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></>,
    hospital: <><rect x="4" y="4" width="16" height="17" rx="3"/><path d="M9 21v-5h6v5M12 8v5M9.5 10.5h5"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const shortcuts = [
  { href: "/health-notebook", title: "건강기록", desc: "진료·검사 기록", icon: "record" },
  { href: "/medications", title: "처방·복약", desc: "복용 일정 관리", icon: "pill" },
  { href: "/health-insights", title: "AI 건강요약", desc: "기록 흐름 요약", icon: "spark" },
  { href: "/inpatient-updates", title: "입원 경과", desc: "병원 공유 소식", icon: "hospital" },
];

export default function Home() {
  return (
    <>
      <HomeRoleRedirect />
      <main className="v9-home">
        <section className="v9-welcome">
          <div className="v9-welcome-copy">
            <span className="v9-kicker">PAWU CARE</span>
            <h1>우리 아이의 오늘을<br/><strong>편안하게 이어보세요.</strong></h1>
            <p>병원 검색부터 예약, 건강기록과 복약관리까지 한곳에서 연결합니다.</p>
          </div>
          <div className="v9-pet-visual" aria-hidden="true">
            <div className="v9-pet-ring"></div>
            <img src="/pawu-v9-03-symbol.svg" alt="" />
          </div>
          <div className="v9-main-actions">
            <Link href="/map" className="v9-action v9-action-primary"><span className="v9-action-icon"><Icon name="search" /></span><span><b>병원 찾기</b><small>가까운 병원 검색</small></span><i>→</i></Link>
            <Link href="/my-reservations" className="v9-action v9-action-secondary"><span className="v9-action-icon"><Icon name="calendar" /></span><span><b>예약 확인</b><small>내 예약 일정 보기</small></span><i>→</i></Link>
          </div>
        </section>

        <section className="v9-content-section">
          <div className="v9-section-head"><div><span>MY PET</span><h2>우리 아이</h2></div><Link href="/pets">전체 보기 →</Link></div>
          <MyHospitalHomeCard />
        </section>

        <section className="v9-content-section v9-shortcut-section">
          <div className="v9-section-head"><div><span>QUICK MENU</span><h2>자주 사용하는 메뉴</h2></div></div>
          <div className="v9-shortcuts">
            {shortcuts.map((item) => <Link key={item.href} href={item.href} className="v9-shortcut"><span><Icon name={item.icon} /></span><b>{item.title}</b><small>{item.desc}</small></Link>)}
          </div>
        </section>

        <HomeCareSummary />

        <section className="v9-register-card">
          <div><span>PAWU FAMILY</span><h2>아직 아이를 등록하지 않았나요?</h2><p>아이를 등록하면 예약과 건강기록을 더 편리하게 관리할 수 있어요.</p></div>
          <Link href="/pets/new">아이 등록하기 →</Link>
        </section>
      </main>
    </>
  );
}
