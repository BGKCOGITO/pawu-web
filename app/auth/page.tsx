import Image from "next/image";
import Link from "next/link";
import HomeAuthNav from "../../components/HomeAuthNav";

const services = [
  {
    title: "동물병원 예약",
    description:
      "내 주변 병원을 찾고 원하는 날짜와 시간에 간편하게 예약하세요.",
    href: "/map",
    label: "병원 찾기",
  },
  {
    title: "건강수첩",
    description:
      "진료기록, 처방, 예방접종 기록을 한 곳에서 확인하고 관리하세요.",
    href: "/health",
    label: "건강 기록 보기",
  },
  {
    title: "복약 관리",
    description:
      "우리 아이의 복약 일정을 놓치지 않도록 한눈에 확인하세요.",
    href: "/medications",
    label: "복약 일정 보기",
  },
];

const features = [
  "내 주변 동물병원 찾기",
  "간편한 진료 예약",
  "진료·처방 기록 관리",
  "예방접종 일정 확인",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <div className="border-b border-neutral-200 bg-neutral-950 px-6 py-3 text-center text-sm font-medium text-white">
        예약부터 건강기록까지, 우리 아이의 건강관리를 PAWU에서 한 번에.
      </div>

      <section className="border-b border-neutral-100">
        <div className="mx-auto flex min-h-[720px] w-full max-w-7xl flex-col px-6 pb-20 pt-7 sm:px-10 lg:px-16">
          <header className="flex items-center justify-between gap-4">
            <Link
              href="/"
              aria-label="PAWU 홈"
              className="inline-flex shrink-0 items-center gap-4"
            >
              <Image
                src="/pawu-symbol.png"
                alt="PAWU"
                width={82}
                height={82}
                priority
                className="h-[72px] w-[72px] object-contain sm:h-[82px] sm:w-[82px]"
              />

              <div className="hidden sm:block">
                <p className="text-xl font-semibold tracking-[0.22em]">
                  PAWU
                </p>
                <p className="mt-1 text-xs tracking-[0.18em] text-neutral-500">
                  Always with us.
                </p>
              </div>
            </Link>

            <HomeAuthNav />
          </header>

          <div className="flex flex-1 items-center">
            <div className="grid w-full items-center gap-14 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-neutral-500">
                  Pet care platform
                </p>

                <h1 className="mt-6 text-5xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                  반려동물과 보호자의
                  <br />
                  모든 순간을 함께.
                </h1>

                <p className="mt-7 max-w-xl text-lg leading-8 text-neutral-600 sm:text-xl">
                  병원 예약부터 진료기록, 처방, 예방접종 관리까지.
                  <br className="hidden sm:block" />
                  PAWU에서 우리 아이의 건강을 한 번에 관리하세요.
                </p>

                <div className="mt-10">
                  <Link
                    href="/map"
                    className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-neutral-950 px-7 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-neutral-800"
                  >
                    내 주변 동물병원 찾기
                  </Link>
                </div>
              </div>

              <div className="relative flex min-h-[430px] items-center justify-center overflow-hidden rounded-[36px] bg-neutral-50 p-8 sm:p-12">
                <div className="absolute inset-x-12 top-12 h-28 rounded-full bg-white blur-3xl" />

                <Image
                  src="/pawu-logo.png"
                  alt="PAWU Always with us."
                  width={720}
                  height={560}
                  priority
                  className="relative h-auto w-full max-w-xl object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-24 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-500">
              Why PAWU
            </p>

            <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">
              병원 예약부터 건강관리까지,
              <br />
              하나의 서비스에서.
            </h2>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <article
                key={feature}
                className="rounded-3xl border border-neutral-200 bg-white p-6"
              >
                <span className="text-sm font-semibold text-neutral-400">
                  0{index + 1}
                </span>

                <h3 className="mt-8 text-xl font-semibold tracking-[-0.02em]">
                  {feature}
                </h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-neutral-950 px-6 py-24 text-white sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-400">
                PAWU Services
              </p>

              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">
                우리 아이를 위한
                <br />
                더 쉬운 건강관리.
              </h2>
            </div>

            <p className="max-w-md text-lg leading-8 text-neutral-400">
              필요한 기능을 복잡하지 않게, 보호자와 병원이 함께 사용할 수
              있도록 만들었습니다.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {services.map((service) => (
              <article
                key={service.title}
                className="flex min-h-80 flex-col rounded-[28px] border border-white/10 bg-white/[0.04] p-7"
              >
                <h3 className="text-2xl font-semibold tracking-[-0.02em]">
                  {service.title}
                </h3>

                <p className="mt-4 text-base leading-7 text-neutral-400">
                  {service.description}
                </p>

                <Link
                  href={service.href}
                  className="mt-auto inline-flex items-center font-semibold text-white"
                >
                  {service.label}
                  <span aria-hidden="true" className="ml-2">
                    →
                  </span>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 px-6 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xl font-semibold tracking-[0.18em]">
              PAWU
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Always with us.
            </p>
          </div>

          <p className="text-sm text-neutral-400">
            © 2026 PAWU. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
