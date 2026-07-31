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
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(109,212,176,0.55),transparent_28%),radial-gradient(circle_at_8%_70%,rgba(255,114,94,0.28),transparent_34%),linear-gradient(135deg,#214f45,#102f2a)]">
              <div className="absolute -right-14 top-24 h-64 w-64 rounded-full border border-white/10" />
              <div className="absolute -right-3 top-36 h-44 w-44 rounded-full border border-white/10" />
              <div className="absolute left-7 top-28 text-white/10">
                <p className="text-[82px] font-black leading-none tracking-[-0.08em] sm:text-[140px]">P</p>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.10)_35%,rgba(8,29,25,0.82)_68%,rgba(8,29,25,0.98)_100%)]" />

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
            <h1 className="mt-4 max-w-3xl break-keep text-[34px] font-black leading-[1.12] tracking-[-0.055em] text-white [text-shadow:0_3px_18px_rgba(0,0,0,0.72)] sm:text-5xl">
              {hospital.name}
            </h1>
            <p className="mt-3 max-w-2xl break-words text-sm font-medium leading-6 text-white/90 [text-shadow:0_2px_10px_rgba(0,0,0,0.68)] sm:text-base">
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
              <FeatureTile icon="P" title="주차" value={availabilityLabel(hospital.parking_available)} active={hospital.parking_available === true} />
              <FeatureTile icon="N" title="야간 진료" value={availabilityLabel(hospital.night_care_available)} active={hospital.night_care_available === true} />
              <FeatureTile icon="E" title="응급 진료" value={availabilityLabel(hospital.emergency_care_available)} active={hospital.emergency_care_available === true} />
            </section>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="space-y-5">
                <ContentCard number="01" title="병원 소개">
                  <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#61736e]">
                    {hospital.description ||
                      "병원에서 직접 등록한 소개가 아직 없습니다. 현재는 확인된 기본 병원정보를 제공하고 있습니다."}
                  </p>
                </ContentCard>

                <ContentCard number="02" title="진료 안내">
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

                <ContentCard number="03" title="위치">
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
              <ContentCard number="04" title="방문 후기">
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

function FeatureTile({ icon, title, value, active }: { icon: string; title: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-[24px] border p-3 text-center shadow-sm sm:p-5 ${active ? "border-[#c5e6db] bg-[#ecf8f3]" : "border-[#e1e6e2] bg-white"}`}>
      <span className={`mx-auto flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-black ${active ? "bg-[#173f37] text-white" : "bg-[#f0f2ef] text-[#81908b]"}`}>{icon}</span>
      <p className="mt-3 text-[11px] font-bold text-[#87958f] sm:text-xs">{title}</p>
      <p className="mt-1 break-keep text-xs font-black text-[#294a43] sm:text-sm">{value}</p>
    </div>
  );
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
