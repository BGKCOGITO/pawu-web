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
  if (value === true) return "가능";
  if (value === false) return "미지원";
  return "확인 필요";
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

  const careTags = [
    hospital.parking_available ? "주차 가능" : null,
    hospital.night_care_available ? "야간 진료" : null,
    hospital.emergency_care_available ? "응급 진료" : null,
    ...services.slice(0, 4),
    ...animals.slice(0, 3).map((animal) => `${animal} 진료`),
  ].filter((item): item is string => Boolean(item));

  return (
    <main className="min-h-screen bg-[#f7f5ef] pb-52 text-[#143b34] sm:pb-36">
      <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-7 sm:pt-7">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/map"
            className="inline-flex min-h-11 items-center rounded-full border border-[#dbe3df] bg-white px-4 text-sm font-black shadow-sm transition active:scale-95"
          >
            ← 병원 찾기
          </Link>
          <MyHospitalButton
            hospitalId={Number(hospital.id)}
            hospitalName={hospital.name}
          />
        </header>

        <section className="mt-4 overflow-hidden rounded-[30px] border border-[#dfe5e1] bg-white shadow-[0_20px_65px_rgba(20,59,52,0.10)] sm:mt-6 sm:rounded-[38px]">
          <div className="relative">
            {hospital.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hospital.image_url}
                alt={`${hospital.name} 대표 이미지`}
                className="h-56 w-full object-cover sm:h-[390px]"
              />
            ) : (
              <div className="flex h-52 items-center justify-center bg-[radial-gradient(circle_at_75%_25%,#d4eee5_0,#eef3ef_40%,#17453b_120%)] sm:h-80">
                <div className="rounded-[30px] border border-white/70 bg-white/60 px-9 py-8 text-center shadow-sm backdrop-blur">
                  <p className="text-3xl font-black tracking-[0.24em] text-[#173f37]">PAWU</p>
                  <p className="mt-2 text-xs font-bold text-[#60756f]">병원 대표 이미지 준비 중</p>
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
          </div>

          <div className="p-5 sm:p-9">
            <div className="flex flex-wrap gap-2">
              {isPartner && <Badge tone="green">PAWU 가입 병원</Badge>}
              <Badge tone={hospital.is_active ? "blue" : "red"}>
                {statusLabel(hospital)}
              </Badge>
              <Badge tone={canReserve ? "dark" : "gray"}>
                {canReserve ? "온라인 예약 가능" : "전화 문의"}
              </Badge>
            </div>

            <h1 className="mt-4 break-keep text-[30px] font-black leading-tight tracking-[-0.045em] sm:text-4xl">
              {hospital.name}
            </h1>
            <p className="mt-3 break-words text-sm leading-6 text-[#60736e] sm:text-base">
              {primaryAddress}
            </p>
            {hospital.phone && (
              <p className="mt-1 text-sm font-bold text-[#60736e]">{hospital.phone}</p>
            )}

            {careTags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {careTags.map((item) => (
                  <Tag key={item}>{item}</Tag>
                ))}
              </div>
            )}

            <div className="mt-6">
              <HospitalDetailActions
                name={hospital.name}
                address={primaryAddress}
                phone={hospital.phone}
                latitude={hospital.latitude}
                longitude={hospital.longitude}
              />
            </div>

            {canReserve && (
              <Link
                href={`/hospital/${hospital.id}/reserve`}
                className="mt-3 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#173f37] px-5 text-base font-black text-white shadow-lg transition active:scale-[0.98]"
              >
                예약하기
              </Link>
            )}

            {!hospital.reservation_enabled && hospital.is_active && (
              <div className="mt-3">
                <PawuAdoptionRequestButton hospitalId={Number(hospital.id)} />
              </div>
            )}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-2 sm:gap-4">
          <QuickInfo
            icon="P"
            label="주차"
            value={availabilityLabel(hospital.parking_available)}
          />
          <QuickInfo
            icon="N"
            label="야간 진료"
            value={availabilityLabel(hospital.night_care_available)}
          />
          <QuickInfo
            icon="E"
            label="응급 진료"
            value={availabilityLabel(hospital.emergency_care_available)}
          />
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <Section title="병원 소개" eyebrow="ABOUT">
              <p className="whitespace-pre-wrap text-sm leading-7 text-[#5f716c] sm:text-base">
                {hospital.description ||
                  "병원에서 직접 등록한 소개가 아직 없습니다. 기본 병원정보를 먼저 제공하고 있습니다."}
              </p>
            </Section>

            <Section title="진료 정보" eyebrow="CARE">
              <div className="space-y-5">
                <InfoGroup title="진료 과목">
                  {services.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {services.map((item) => (
                        <Tag key={item}>{item}</Tag>
                      ))}
                    </div>
                  ) : (
                    <EmptyText>등록된 진료 과목이 없습니다.</EmptyText>
                  )}
                </InfoGroup>

                <InfoGroup title="진료 가능 동물">
                  {animals.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {animals.map((item) => (
                        <Tag key={item}>{item}</Tag>
                      ))}
                    </div>
                  ) : (
                    <EmptyText>등록된 진료 동물 정보가 없습니다.</EmptyText>
                  )}
                </InfoGroup>
              </div>
            </Section>

            <Section title="위치 및 주소" eyebrow="LOCATION">
              <dl className="divide-y divide-[#e8ece9] overflow-hidden rounded-2xl bg-[#f6f7f3] px-5">
                <InfoBlock label="도로명주소" value={hospital.road_address ?? "정보 없음"} />
                <InfoBlock label="지번주소" value={hospital.lot_address ?? "정보 없음"} />
              </dl>
              <div className="mt-4 rounded-2xl border border-[#dfe6e2] bg-[#eef4f1] p-4 text-sm leading-6 text-[#516963]">
                정확한 진료시간과 접수 가능 여부는 방문 전에 병원으로 확인해 주세요.
              </div>
            </Section>
          </div>

          <aside className="space-y-5">
            <Section title="이용 안내" eyebrow="VISIT INFO">
              <dl className="space-y-4">
                <InfoRow label="영업 상태" value={statusLabel(hospital)} />
                <InfoRow
                  label="예약"
                  value={canReserve ? "온라인 예약 가능" : "전화 문의"}
                />
                <InfoRow label="전화" value={hospital.phone ?? "정보 없음"} />
                <InfoRow
                  label="정보 업데이트"
                  value={formatDate(hospital.public_data_updated_at)}
                />
              </dl>
            </Section>

            <Section title="정보 출처" eyebrow="PAWU GUIDE">
              <div
                className={`rounded-2xl border px-4 py-4 text-sm leading-6 ${
                  isPartner
                    ? "border-[#bfe4d7] bg-[#edf9f4] text-[#17604e]"
                    : "border-[#dce5ec] bg-[#f1f6f9] text-[#416477]"
                }`}
              >
                <strong className="block">
                  {isPartner ? "PAWU 가입 병원" : "공공데이터 기반 병원"}
                </strong>
                {isPartner
                  ? "병원이 PAWU에 가입해 직접 정보를 관리하고 있습니다."
                  : "공개된 행정정보를 기반으로 제공됩니다. 실제 운영 여부는 방문 전에 확인해 주세요."}
              </div>
            </Section>
          </aside>
        </div>

        <div className="mt-5">
          <HospitalVisitReviews hospitalId={Number(hospital.id)} />
        </div>
      </div>

      {canReserve && (
        <div className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 px-3 sm:bottom-5 sm:px-6">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-[24px] border border-[#dfe5e1] bg-white/95 p-3 shadow-[0_18px_60px_rgba(20,59,52,0.24)] backdrop-blur-xl">
            <div className="min-w-0 flex-1 px-2">
              <p className="truncate text-xs font-bold text-[#71807c]">{hospital.name}</p>
              <p className="mt-0.5 text-sm font-black text-[#143b34]">온라인 예약 가능</p>
            </div>
            <Link
              href={`/hospital/${hospital.id}/reserve`}
              className="shrink-0 rounded-2xl bg-[#ff725e] px-7 py-4 text-sm font-black text-white shadow-lg transition active:scale-95"
            >
              예약하기
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "green" | "blue" | "red" | "dark" | "gray";
}) {
  const tones = {
    green: "bg-[#e2f5ee] text-[#17604e]",
    blue: "bg-[#e8f1fb] text-[#34678c]",
    red: "bg-[#fff0ed] text-[#c74f3f]",
    dark: "bg-[#173f37] text-white",
    gray: "bg-neutral-100 text-neutral-500",
  };
  return (
    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${tones[tone]}`}>
      {children}
    </span>
  );
}

function QuickInfo({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#dfe5e1] bg-white px-2 py-4 text-center shadow-sm sm:rounded-[26px] sm:p-5">
      <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#edf5f1] text-xs font-black text-[#17604e]">
        {icon}
      </span>
      <p className="mt-2 text-[11px] font-bold text-[#81908b] sm:text-xs">{label}</p>
      <p className="mt-1 break-keep text-sm font-black text-[#173f37] sm:text-base">{value}</p>
    </div>
  );
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#dfe5e1] bg-white p-5 shadow-sm sm:p-7">
      <p className="text-[10px] font-black tracking-[0.2em] text-[#ff725e]">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-black tracking-[-0.025em]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function InfoGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-black text-[#294a43]">{title}</h3>
      {children}
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[#dce5e1] bg-[#f7f9f6] px-3.5 py-2 text-sm font-bold text-[#34534c]">
      {children}
    </span>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[#7a8985]">{children}</p>;
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-4">
      <dt className="text-xs font-bold text-[#87958f]">{label}</dt>
      <dd className="mt-1.5 break-words text-sm leading-6 text-[#294a43]">{value}</dd>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#e8ece9] pb-4 last:border-0 last:pb-0">
      <dt className="shrink-0 text-sm text-[#788782]">{label}</dt>
      <dd className="break-words text-right text-sm font-black text-[#294a43]">{value}</dd>
    </div>
  );
}
