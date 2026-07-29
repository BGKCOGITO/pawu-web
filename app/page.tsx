import Link from "next/link";
import HomeRoleRedirect from "@/components/HomeRoleRedirect";
import HomeCareSummary from "@/components/home/HomeCareSummary";
import MyHospitalHomeCard from "@/components/guardian/MyHospitalHomeCard";

const quick = [
  { href: "/emergency", tag: "EMERGENCY", title: "응급·야간 병원", text: "가까운 병원에 바로 전화하고 길찾기", tone: "coral", icon: "!" },
  { href: "/map", tag: "NEARBY", title: "지금 갈 수 있는 병원", text: "영업 중인 병원을 지도에서 바로 찾기", tone: "mint", icon: "⌖" },
  { href: "/my-reservations", tag: "SCHEDULE", title: "예약 확인", text: "대기·승인·완료 일정을 한눈에", tone: "coral", icon: "▦" },
  { href: "/health-notebook", tag: "RECORD", title: "건강 타임라인", text: "진료와 처방 기록을 이어서 보기", tone: "violet", icon: "✦" },
  { href: "/health-insights", tag: "AI", title: "AI 건강 요약", text: "우리 아이 기록의 흐름을 한눈에 정리", tone: "mint", icon: "◎" },
  { href: "/medications", tag: "MEDICATION", title: "복약 관리", text: "오늘 먹을 약과 복용 시간을 확인하기", tone: "mint", icon: "💊" },
  { href: "/inpatient-updates", tag: "INPATIENT", title: "입원 경과", text: "병원에서 공유한 식사·투약·회복 소식 확인", tone: "coral", icon: "♡" },
  { href: "/my-hospitals", tag: "FAVORITE", title: "즐겨찾는 병원", text: "자주 가는 병원을 빠르게 예약하고 연락하기", tone: "violet", icon: "★" },
];

export default function Home() {
  return (
    <>
      <HomeRoleRedirect />
      <main className="pawu-home">
      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">PAWU CARE FLOW</span>
          <h1>우리 아이의 오늘을<br/><em>한눈에 이어보세요.</em></h1>
          <p>병원 검색부터 예약, 건강기록까지 흩어지지 않게 연결합니다.</p>
          <div className="hero-actions"><Link href="/map" className="primary-action">병원 찾기 <span>↗</span></Link><Link href="/pets" className="round-action">우리 아이 등록</Link></div>
        </div>
        <div className="hero-orbit" aria-hidden="true"><div className="orbit-core">PAWU</div><span className="orbit-dot one">+</span><span className="orbit-dot two">♡</span><span className="orbit-dot three">•</span></div>
      </section>

      <section className="home-status-strip">
        <div><small>TODAY</small><strong>오늘도 함께</strong></div><span></span><div><small>CARE</small><strong>기록은 차곡차곡</strong></div><span></span><div><small>NEARBY</small><strong>가까운 병원부터</strong></div>
      </section>

      <HomeCareSummary />
      <MyHospitalHomeCard />

      <section className="home-section">
        <div className="section-heading"><div><span>QUICK ROUTES</span><h2>필요한 곳으로 바로</h2></div><Link href="/account">전체 메뉴 ↗</Link></div>
        <div className="route-grid">{quick.map((item) => <Link href={item.href} key={item.href} className={`route-card ${item.tone}`}><div className="route-top"><span>{item.tag}</span><b>{item.icon}</b></div><h3>{item.title}</h3><p>{item.text}</p><i>열기 →</i></Link>)}</div>
      </section>

      <section className="home-section home-pet-panel">
        <div><span className="eyebrow">MY FAMILY</span><h2>아이를 등록하면<br/>PAWU가 더 정확해져요.</h2><p>예약할 때마다 정보를 다시 입력하지 않고 건강 기록도 아이별로 관리할 수 있어요.</p><Link href="/pets/new" className="dark-link">첫 아이 등록하기 →</Link></div>
        <div className="pet-constellation"><span>DOG</span><span>CAT</span><span>ETC</span></div>
      </section>
      </main>
    </>
  );
}
