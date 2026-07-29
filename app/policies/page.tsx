import Link from "next/link";

const policies = [
  ["/policies/privacy", "개인정보처리방침", "회원, 보호자, 반려동물, 병원 정보 처리 원칙"],
  ["/policies/terms", "서비스 이용약관", "PAWU 서비스 이용 조건과 책임 범위"],
  ["/policies/medical-data", "의료정보 처리 안내", "진료기록의 작성, 열람, 보관과 보호 원칙"],
  ["/policies/ai", "AI 이용 및 안전 안내", "AI의 역할, 제한, 응급 상황 안내 원칙"],
  ["/policies/marketing", "마케팅 수신 안내", "선택 동의와 철회 방법"],
];

export default function PoliciesPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="rounded-xl border bg-white px-4 py-2 text-sm">← 홈</Link>
        <header className="mt-8 rounded-[2rem] bg-black p-8 text-white">
          <p className="text-sm text-gray-300">PAWU Trust Center</p>
          <h1 className="mt-2 text-3xl font-black">정책 및 안전 안내</h1>
          <p className="mt-3 text-sm text-gray-300">출시 전 법률 검토가 필요한 초안입니다.</p>
        </header>
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {policies.map(([href, title, description]) => (
            <Link key={href} href={href} className="rounded-3xl border bg-white p-6 hover:border-black">
              <h2 className="text-xl font-black">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{description}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
