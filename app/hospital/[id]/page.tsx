import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import HospitalDetailActions from "@/components/guardian/HospitalDetailActions";
import HospitalVisitReviews from "@/components/guardian/HospitalVisitReviews";
import MyHospitalButton from "@/components/guardian/MyHospitalButton";
import PawuAdoptionRequestButton from "@/components/guardian/PawuAdoptionRequestButton";
import { supabase } from "@/lib/supabase";

type Props = { params: Promise<{ id: string }> };

type Hospital = {
  id: number;
  name: string;
  address: string;
  road_address: string | null;
  lot_address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  reservation_enabled: boolean;
  description: string | null;
  image_url: string | null;
  services: string[] | null;
  supported_animals: string[] | null;
  animal_types: string[] | null;
  parking_available: boolean | null;
  night_care_available: boolean | null;
  emergency_care_available: boolean | null;
  is_active: boolean;
  is_published: boolean;
  source_type: "public_data" | "pawu_partner";
  public_data_updated_at: string | null;
  business_status: string | null;
  detailed_business_status: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "정보 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "정보 없음";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function statusLabel(hospital: Hospital) {
  return (
    hospital.detailed_business_status ||
    hospital.business_status ||
    (hospital.is_active ? "영업중" : "영업 상태 확인 필요")
  );
}

function availabilityLabel(value: boolean | null) {
  if (value === true) return "이용 가능";
  if (value === false) return "미지원";
  return "병원 문의";
}

export default async function HospitalDetailPage({ params }: Props) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("hospitals")
    .select(
      [
        "id",
        "name",
        "address",
        "road_address",
        "lot_address",
        "phone",
        "latitude",
        "longitude",
        "reservation_enabled",
        "description",
        "image_url",
        "services",
        "supported_animals",
        "animal_types",
        "parking_available",
        "night_care_available",
        "emergency_care_available",
        "is_active",
        "is_published",
        "source_type",
        "public_data_updated_at",
        "business_status",
        "detailed_business_status",
      ].join(","),
    )
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const hospital = data as unknown as Hospital;
  const services = hospital.services ?? [];
  const animals = Array.from(
    new Set([
      ...(hospital.supported_animals ?? []),
      ...(hospital.animal_types ?? []),
    ]),
  );
  const isPartner = hospital.source_type === "pawu_partner";
  const canReserve = hospital.is_active && hospital.reservation_enabled;
  const primaryAddress =
    hospital.road_address || hospital.address || hospital.lot_address || "주소 정보 없음";

  return (
    <main className="min-h-screen bg-[#f4f5f1] pb-52 text-[#153b34] sm:pb-36">
      <div className="relative mx-auto max-w-6xl overflow-hidden bg-white shadow-[0_30px_90px_rgba(20,59,52,0.08)] sm:my-7 sm:rounded-[38px]">
        <section className="relative min-h-[360px] overflow-hidden bg-[#173f37] sm:min-h-[460px]">
          {hospital.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hospital.image_url}
              alt={`${hospital.name} 대표 이미지`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(145deg,#315f54_0%,#1c4a41_45%,#0b2924_100%)]">
              <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(ellipse_at_top_right,rgba(134,225,190,0.28),transparent_62%)]" />
              <div className="absolute bottom-24 left-6 right-6 h-px bg-white/10" />
            </div>
          )}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,18,15,0.08)_0%,rgba(2,18,15,0.18)_38%,rgba(2,18,15,0.88)_66%,rgba(2,18,15,1)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[52%] bg-black/25" />

          <div className="relative z-10 flex items-center justify-between px-4 pt-[max(18px,env(safe-area-inset-top))] sm:px-8 sm:pt-8">
            <Link
              href="/map"
              aria-label="병원 찾기로 돌아가기"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 bg-black/20 px-4 text-sm font-black text-white backdrop-blur-xl transition active:scale-95"
            >
              <span className="text-lg">‹</span>
              병원 찾기
            </Link>
            <div className="rounded-full bg-white/95 p-1 shadow-lg backdrop-blur-xl">
              <MyHospitalButton hospitalId={Number(hospital.id)} hospitalName={hospital.name} />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-7 sm:px-10 sm:pb-10">
            <div className="flex flex-wrap gap-2">
              <HeroBadge tone={isPartner ? "partner" : "public"}>
                {isPartner ? "병원 직접 관리" : "공공데이터 정보"}
              </HeroBadge>
              <HeroBadge tone={hospital.is_active ? "open" : "closed"}>
                {statusLabel(hospital)}
              </HeroBadge>
              <HeroBadge tone={canReserve ? "reserve" : "neutral"}>
                {canReserve ? "온라인 예약 가능" : "전화 문의"}
              </HeroBadge>
            </div>
            <div className="mt-4 rounded-[20px] border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-[2px] sm:inline-block sm:px-5 sm:py-4">
              <h1
                className="max-w-3xl break-keep text-[34px] font-black leading-[1.12] tracking-[-0.055em] sm:text-5xl"
                style={{
                  color: "#ffffff",
                  WebkitTextFillColor: "#ffffff",
                  textShadow: "0 3px 14px rgba(0,0,0,0.95)",
                }}
              >
                {hospital.name}
              </h1>
            </div>
            <p
              className="mt-3 max-w-2xl break-words text-sm font-semibold leading-6 sm:text-base"
              style={{
                color: "rgba(255,255,255,0.94)",
                WebkitTextFillColor: "rgba(255,255,255,0.94)",
                textShadow: "0 2px 10px rgba(0,0,0,0.92)",
              }}
            >
              {primaryAddress}
            </p>
          </div>
        </section>

        <section className="relative z-20 -mt-1 rounded-t-[34px] bg-[#f4f5f1] px-4 pb-10 pt-5 sm:rounded-t-[46px] sm:px-8 sm:pt-8">
          <div className="mx-auto max-w-5xl">
            <section className="rounded-[28px] bg-white p-4 shadow-[0_16px_45px_rgba(20,59,52,0.09)] sm:p-6">
              <HospitalDetailActions
                name={hospital.name}
                address={primaryAddress}
                phone={hospital.phone}
                latitude={hospital.latitude}
                longitude={hospital.longitude}
              />
              {canReserve ? (
                <Link
                  href={`/hospital/${hospital.id}/reserve`}
                  className="mt-4 flex min-h-16 w-full items-center justify-between rounded-[22px] bg-[#ff725e] px-5 text-white shadow-[0_14px_30px_rgba(255,114,94,0.32)] transition active:scale-[0.985]"
                >
                  <span>
                    <span className="block text-xs font-bold text-white/75">PAWU 간편예약</span>
                    <span className="mt-0.5 block text-lg font-black">진료 예약하기</span>
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/18 text-xl">→</span>
                </Link>
              ) : hospital.is_active ? (
                <div className="mt-4">
                  <PawuAdoptionRequestButton hospitalId={Number(hospital.id)} />
                </div>
              ) : null}
            </section>

            <section className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-4">
              <FeatureTile icon="parking" title="주차" value={availabilityLabel(hospital.parking_available)} active={hospital.parking_available === true} />
              <FeatureTile icon="moon" title="야간 진료" value={availabilityLabel(hospital.night_care_available)} active={hospital.night_care_available === true} />
              <FeatureTile icon="emergency" title="응급 진료" value={availabilityLabel(hospital.emergency_care_available)} active={hospital.emergency_care_available === true} />
            </section>

            <section className="mt-5 overflow-hidden rounded-[30px] border border-[#dce5e1] bg-[#153b34] text-white shadow-[0_18px_45px_rgba(20,59,52,0.16)]">
              <div className="grid gap-0 sm:grid-cols-[1fr_auto] sm:items-stretch">
                <div className="p-5 sm:p-7">
                  <p className="text-xs font-black tracking-[0.18em] text-white/50">TODAY&apos;S GUIDE</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${hospital.is_active ? "bg-[#35b786] text-white" : "bg-[#ff725e] text-white"}`}>
                      {statusLabel(hospital)}
                    </span>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${canReserve ? "bg-white text-[#153b34]" : "border border-white/20 bg-white/10 text-white/80"}`}>
                      {canReserve ? "온라인 예약 가능" : "방문 전 전화 확인"}
                    </span>
                  </div>
                  <h2 className="mt-5 text-[22px] font-black tracking-[-0.035em] sm:text-2xl">오늘 진료 안내</h2>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    진료시간은 병원 사정에 따라 변경될 수 있습니다. 방문 전 전화로 당일 접수와 종료 시간을 확인해 주세요.
                  </p>
                </div>
                <div className="border-t border-white/10 p-4 sm:flex sm:min-w-[220px] sm:items-center sm:border-l sm:border-t-0 sm:p-6">
                  {hospital.phone ? (
                    <a href={`tel:${hospital.phone}`} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-white px-5 text-sm font-black text-[#153b34] shadow-lg transition active:scale-[0.98]">
                      <ActionIcon name="phone" />
                      병원에 전화하기
                    </a>
                  ) : (
                    <div className="rounded-[20px] border border-white/15 bg-white/10 px-5 py-4 text-center text-sm font-bold text-white/60">전화번호 정보 없음</div>
                  )}
                </div>
              </div>
            </section>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="space-y-5">
                <ContentCard number="01" title="병원 기본정보">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailItem icon="location" label="주소" value={primaryAddress} />
                    <DetailItem icon="phone" label="전화번호" value={hospital.phone ?? "정보 없음"} href={hospital.phone ? `tel:${hospital.phone}` : undefined} />
                    <DetailItem icon="refresh" label="최근 정보 업데이트" value={formatDate(hospital.public_data_updated_at)} />
                    <DetailItem icon="shield" label="정보 관리 방식" value={isPartner ? "병원 직접 관리" : "공공데이터 기반"} />
                  </div>
                </ContentCard>

                <ContentCard number="02" title="병원 소개">
                  <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#61736e]">
                    {hospital.description ||
                      "병원에서 직접 등록한 소개가 아직 없습니다. 현재는 확인된 기본 병원정보를 제공하고 있습니다."}
                  </p>
                </ContentCard>

                <ContentCard number="03" title="진료 안내">
                  <InfoCollection title="진료 과목">
                    {services.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {services.map((item) => <Pill key={item}>{item}</Pill>)}
                      </div>
                    ) : (
                      <MutedText>등록된 진료 과목이 없습니다.</MutedText>
                    )}
                  </InfoCollection>
                  <div className="my-6 h-px bg-[#edf0ed]" />
                  <InfoCollection title="진료 가능 동물">
                    {animals.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {animals.map((item) => <Pill key={item}>{item}</Pill>)}
                      </div>
                    ) : (
                      <MutedText>등록된 진료 동물 정보가 없습니다.</MutedText>
                    )}
                  </InfoCollection>
                </ContentCard>

                <ContentCard number="04" title="위치">
                  <div className="overflow-hidden rounded-[24px] bg-[#153b34] p-5 text-white sm:p-6">
                    <div className="flex items-start justify-between gap-5">
                      <div>
                        <p className="text-xs font-black tracking-[0.18em] text-white/55">LOCATION</p>
                        <p className="mt-3 break-words text-lg font-black leading-7">{primaryAddress}</p>
                      </div>
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/12 text-xl">⌖</span>
                    </div>
                    <div className="mt-6 grid gap-2 text-sm text-white/72">
                      {hospital.road_address && <AddressLine label="도로명" value={hospital.road_address} />}
                      {hospital.lot_address && <AddressLine label="지번" value={hospital.lot_address} />}
                    </div>
                    <div className="mt-5">
                      <HospitalDetailActions
                        name={hospital.name}
                        address={primaryAddress}
                        phone={null}
                        latitude={hospital.latitude}
                        longitude={hospital.longitude}
                      />
                    </div>
                  </div>
                </ContentCard>
              </div>

              <aside className="space-y-5">
                <SideCard title="방문 전 확인">
                  <dl className="space-y-4">
                    <InfoRow label="영업 상태" value={statusLabel(hospital)} />
                    <InfoRow label="온라인 예약" value={canReserve ? "가능" : "전화 문의"} />
                    <InfoRow label="전화번호" value={hospital.phone ?? "정보 없음"} />
                    <InfoRow label="정보 갱신일" value={formatDate(hospital.public_data_updated_at)} />
                  </dl>
                  <p className="mt-5 rounded-2xl bg-[#f3f5f2] p-4 text-xs leading-5 text-[#6f807b]">
                    실제 진료시간과 당일 접수 가능 여부는 방문 전에 병원으로 확인해 주세요.
                  </p>
                </SideCard>

                <SideCard title="정보 신뢰 안내">
                  <div className={`rounded-[22px] border p-4 ${isPartner ? "border-[#bfe4d7] bg-[#edf9f4]" : "border-[#dce5ec] bg-[#f1f6f9]"}`}>
                    <p className={`text-sm font-black ${isPartner ? "text-[#17604e]" : "text-[#416477]"}`}>
                      {isPartner ? "병원에서 직접 관리 중" : "공공데이터 기반 정보"}
                    </p>
                    <p className={`mt-2 text-xs leading-5 ${isPartner ? "text-[#4f786c]" : "text-[#67808e]"}`}>
                      {isPartner
                        ? "병원이 PAWU에 가입해 소개와 예약 정보를 직접 관리하고 있습니다."
                        : "공개된 행정정보를 기반으로 제공되며 실제 운영정보와 다를 수 있습니다."}
                    </p>
                  </div>
                </SideCard>
              </aside>
            </div>

            <div className="mt-5">
              <ContentCard number="05" title="방문 후기">
                <div className="mb-5 rounded-[20px] bg-[#f5f6f3] px-4 py-3 text-sm leading-6 text-[#687a75]">
                  PAWU는 병원을 점수로 평가하지 않습니다. 실제 방문 보호자의 경험을 글로 확인할 수 있습니다.
                </div>
                <HospitalVisitReviews hospitalId={Number(hospital.id)} />
              </ContentCard>
            </div>
          </div>
        </section>
      </div>

      {canReserve && (
        <div className="fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-40 px-3 sm:bottom-5 sm:px-6">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-[25px] border border-white/60 bg-[#153b34]/96 p-3 pl-5 shadow-[0_20px_60px_rgba(20,59,52,0.32)] backdrop-blur-xl">
            <div className="min-w-0 flex-1 text-white">
              <p className="truncate text-xs font-bold text-white/60">{hospital.name}</p>
              <p className="mt-1 text-sm font-black">온라인 예약 가능</p>
            </div>
            <Link
              href={`/hospital/${hospital.id}/reserve`}
              className="shrink-0 rounded-[18px] bg-[#ff725e] px-7 py-4 text-sm font-black text-white shadow-lg transition active:scale-95"
            >
              예약하기
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function HeroBadge({ children, tone }: { children: ReactNode; tone: "partner" | "public" | "open" | "closed" | "reserve" | "neutral" }) {
  const styles = {
    partner: "border-[#8ee1c3]/40 bg-[#3dbb8d]/25 text-[#c9ffec]",
    public: "border-white/20 bg-white/10 text-white/80",
    open: "border-[#9ee8d0]/35 bg-[#2aa879]/25 text-[#c9ffec]",
    closed: "border-[#ffb8ae]/35 bg-[#ff725e]/20 text-[#ffd5cf]",
    reserve: "border-white/25 bg-white text-[#173f37]",
    neutral: "border-white/20 bg-black/15 text-white/72",
  };
  return <span className={`rounded-full border px-3 py-1.5 text-xs font-black backdrop-blur-xl ${styles[tone]}`}>{children}</span>;
}

function FeatureTile({ icon, title, value, active }: { icon: "parking" | "moon" | "emergency"; title: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-[24px] border p-3 text-center shadow-sm sm:p-5 ${active ? "border-[#c5e6db] bg-[#ecf8f3]" : "border-[#e1e6e2] bg-white"}`}>
      <span className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl ${active ? "bg-[#173f37] text-white" : "bg-[#f0f2ef] text-[#81908b]"}`}>
        <ActionIcon name={icon} />
      </span>
      <p className="mt-3 text-[11px] font-bold text-[#87958f] sm:text-xs">{title}</p>
      <p className="mt-1 break-keep text-xs font-black text-[#294a43] sm:text-sm">{value}</p>
    </div>
  );
}

function DetailItem({ icon, label, value, href }: { icon: IconName; label: string; value: string; href?: string }) {
  const content = (
    <div className="flex min-h-[88px] items-start gap-3 rounded-[22px] border border-[#e5eae6] bg-[#f8faf7] p-4 transition hover:border-[#cbdad4]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1b5146] shadow-sm">
        <ActionIcon name={icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold text-[#87958f]">{label}</span>
        <span className="mt-1 block break-words text-sm font-black leading-6 text-[#294a43]">{value}</span>
      </span>
    </div>
  );
  return href ? <a href={href}>{content}</a> : content;
}

type IconName = "parking" | "moon" | "emergency" | "location" | "phone" | "refresh" | "shield";

function ActionIcon({ name }: { name: IconName }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "parking") return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 17V7h4.2a3.2 3.2 0 0 1 0 6.4H9" /></svg>;
  if (name === "moon") return <svg {...common}><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" /></svg>;
  if (name === "emergency") return <svg {...common}><path d="M12 2v20M2 12h20" /><circle cx="12" cy="12" r="8" /></svg>;
  if (name === "location") return <svg {...common}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  if (name === "phone") return <svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" /></svg>;
  if (name === "refresh") return <svg {...common}><path d="M20 11a8 8 0 0 0-14.8-4M4 3v5h5M4 13a8 8 0 0 0 14.8 4M20 21v-5h-5" /></svg>;
  return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
}

function ContentCard({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[30px] border border-[#e0e5e1] bg-white p-5 shadow-[0_12px_38px_rgba(20,59,52,0.055)] sm:p-7">
      <div className="flex items-center gap-3">
        <span className="text-xs font-black tracking-[0.18em] text-[#ff725e]">{number}</span>
        <div className="h-px flex-1 bg-[#ecefec]" />
      </div>
      <h2 className="mt-4 text-[22px] font-black tracking-[-0.035em] text-[#153b34]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#e0e5e1] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-black tracking-[-0.025em]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function InfoCollection({ title, children }: { title: string; children: ReactNode }) {
  return <div><h3 className="mb-3 text-sm font-black text-[#294a43]">{title}</h3>{children}</div>;
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-[#dce5e1] bg-[#f7f9f6] px-3.5 py-2 text-sm font-bold text-[#34534c]">{children}</span>;
}

function MutedText({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[#7a8985]">{children}</p>;
}

function AddressLine({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[50px_1fr] gap-3"><span className="font-bold text-white/45">{label}</span><span className="break-words">{value}</span></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#e8ece9] pb-4 last:border-0 last:pb-0">
      <dt className="shrink-0 text-sm text-[#788782]">{label}</dt>
      <dd className="break-words text-right text-sm font-black text-[#294a43]">{value}</dd>
    </div>
  );
}
