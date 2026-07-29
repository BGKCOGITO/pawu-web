import Link from "next/link";
import AdminHeader from "../../components/admin/AdminHeader";
import StatCard from "../../components/admin/StatCard";
import { supabaseAdmin } from "../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type RecentReservation = {
  id: number;
  pet_name: string;
  guardian_name: string;
  reservation_date: string;
  reservation_time: string;
  status: string;
  created_at: string;
};

function getStatusLabel(status: string) {
  switch (status) {
    case "requested":
      return "승인 대기";
    case "approved":
      return "예약 승인";
    case "rejected":
      return "예약 거절";
    case "cancelled":
      return "예약 취소";
    case "completed":
      return "진료 완료";
    default:
      return status;
  }
}

export default async function AdminDashboardPage() {
  const [
    hospitalsResult,
    partnerHospitalsResult,
    publicHospitalsResult,
    inactiveHospitalsResult,
    missingCoordinatesResult,
    reservationsResult,
    pendingReservationsResult,
    recentReservationsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("hospitals")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("hospitals")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "pawu_partner"),
    supabaseAdmin
      .from("hospitals")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "public_data"),
    supabaseAdmin
      .from("hospitals")
      .select("id", { count: "exact", head: true })
      .eq("is_active", false),
    supabaseAdmin
      .from("hospitals")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .or("latitude.is.null,longitude.is.null,latitude.eq.0,longitude.eq.0"),
    supabaseAdmin
      .from("reservations")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("status", "requested"),
    supabaseAdmin
      .from("reservations")
      .select(
        "id, pet_name, guardian_name, reservation_date, reservation_time, status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const recentReservations =
    (recentReservationsResult.data ?? []) as RecentReservation[];

  const errors = [
    hospitalsResult.error,
    partnerHospitalsResult.error,
    publicHospitalsResult.error,
    inactiveHospitalsResult.error,
    missingCoordinatesResult.error,
    reservationsResult.error,
    pendingReservationsResult.error,
    recentReservationsResult.error,
  ].filter(Boolean);

  return (
    <div>
      <AdminHeader
        title="관리자 대시보드"
        description="PAWU 병원, 예약, 공공데이터 상태를 한눈에 확인합니다."
        action={
          <Link
            href="/admin/hospitals"
            className="inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
          >
            병원관리 열기
          </Link>
        }
      />

      {errors.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          일부 통계를 불러오지 못했습니다. 아직 생성하지 않은 테이블이나
          컬럼이 있는지 확인해 주세요.
        </div>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="전체 병원"
          value={hospitalsResult.count ?? 0}
          description="공공데이터 병원과 PAWU 제휴병원"
          icon="✚"
        />

        <StatCard
          label="공공데이터 병원"
          value={publicHospitalsResult.count ?? 0}
          description="위치 정보 제공용 일반 병원"
          icon="D"
          tone="blue"
        />

        <StatCard
          label="PAWU 제휴병원"
          value={partnerHospitalsResult.count ?? 0}
          description="예약 및 병원관리 기능 사용 가능"
          icon="P"
          tone="green"
        />

        <StatCard
          label="비활성 병원"
          value={inactiveHospitalsResult.count ?? 0}
          description="폐업, 휴업 등으로 사용자 화면에서 숨김"
          icon="!"
          tone="red"
        />
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="전체 예약"
          value={reservationsResult.count ?? 0}
          icon="▣"
        />

        <StatCard
          label="승인 대기 예약"
          value={pendingReservationsResult.count ?? 0}
          icon="…"
          tone="amber"
        />

        <StatCard
          label="좌표 미생성"
          value={missingCoordinatesResult.count ?? 0}
          description="주소는 있으나 위도·경도가 저장되지 않은 병원"
          icon="⌖"
          tone="amber"
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-lg font-black">최근 예약</h2>
              <p className="mt-1 text-sm text-slate-500">
                최근 접수된 예약 5건
              </p>
            </div>

            <Link
              href="/admin/reservations"
              className="text-sm font-bold text-slate-700"
            >
              전체 보기
            </Link>
          </div>

          {recentReservations.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              아직 접수된 예약이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-bold">
                      {reservation.pet_name}
                      <span className="ml-2 text-sm font-normal text-slate-500">
                        보호자 {reservation.guardian_name}
                      </span>
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {reservation.reservation_date}{" "}
                      {reservation.reservation_time.slice(0, 5)}
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {getStatusLabel(reservation.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black">빠른 관리</h2>
          <p className="mt-1 text-sm text-slate-500">
            자주 사용하는 관리자 메뉴
          </p>

          <div className="mt-5 space-y-3">
            <Link
              href="/admin/hospitals"
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 font-bold hover:bg-slate-50"
            >
              병원 목록 및 공공데이터 관리
              <span>→</span>
            </Link>

            <Link
              href="/admin/reservations"
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 font-bold hover:bg-slate-50"
            >
              예약 요청 승인 및 거절
              <span>→</span>
            </Link>

            <Link
              href="/"
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 font-bold hover:bg-slate-50"
            >
              PAWU 사용자 화면 확인
              <span>→</span>
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
