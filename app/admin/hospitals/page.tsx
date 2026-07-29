import AdminHeader from "../../../components/admin/AdminHeader";
import StatCard from "../../../components/admin/StatCard";
import HospitalTable from "../../../components/admin/HospitalTable";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  source?: string;
  status?: string;
  coordinates?: string;
  page?: string;
}>;

type Hospital = {
  id: number;
  name: string;
  address: string | null;
  road_address: string | null;
  lot_address: string | null;
  latitude: number | null;
  longitude: number | null;
  source_type: "public_data" | "pawu_partner";
  is_active: boolean;
  business_status: string | null;
  detailed_business_status: string | null;
  reservation_enabled: boolean;
  public_data_updated_at: string | null;
};

const PAGE_SIZE = 20;

export default async function AdminHospitalsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const source = params.source ?? "all";
  const status = params.status ?? "active";
  const coordinates = params.coordinates ?? "all";
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;

  let query = supabaseAdmin
    .from("hospitals")
    .select(
      `
        id,
        name,
        address,
        road_address,
        lot_address,
        latitude,
        longitude,
        source_type,
        is_active,
        business_status,
        detailed_business_status,
        reservation_enabled,
        public_data_updated_at
      `,
      { count: "exact" }
    );

  if (q) {
    const escaped = q.replace(/[%_,]/g, "");
    query = query.or(
      `name.ilike.%${escaped}%,address.ilike.%${escaped}%,road_address.ilike.%${escaped}%,lot_address.ilike.%${escaped}%`
    );
  }

  if (source === "public_data" || source === "pawu_partner") {
    query = query.eq("source_type", source);
  }

  if (status === "active") {
    query = query.eq("is_active", true);
  } else if (status === "inactive") {
    query = query.eq("is_active", false);
  }

  if (coordinates === "missing") {
    query = query.or(
      "latitude.is.null,longitude.is.null,latitude.eq.0,longitude.eq.0"
    );
  } else if (coordinates === "ready") {
    query = query
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .neq("latitude", 0)
      .neq("longitude", 0);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [
    listResult,
    totalResult,
    publicResult,
    partnerResult,
    inactiveResult,
    missingCoordinatesResult,
  ] = await Promise.all([
    query
      .order("source_type", { ascending: false })
      .order("name", { ascending: true })
      .range(from, to),
    supabaseAdmin
      .from("hospitals")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("hospitals")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "public_data"),
    supabaseAdmin
      .from("hospitals")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "pawu_partner"),
    supabaseAdmin
      .from("hospitals")
      .select("id", { count: "exact", head: true })
      .eq("is_active", false),
    supabaseAdmin
      .from("hospitals")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .or("latitude.is.null,longitude.is.null,latitude.eq.0,longitude.eq.0"),
  ]);

  const hospitals = (listResult.data ?? []) as Hospital[];
  const resultCount = listResult.count ?? 0;
  const totalPages = Math.max(
    1,
    Math.ceil(resultCount / PAGE_SIZE)
  );

  return (
    <div>
      <AdminHeader
        title="병원관리"
        description="공공데이터 병원과 PAWU 제휴병원의 영업 상태, 예약 가능 여부, 지도 좌표를 관리합니다."
      />

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="전체 병원"
          value={totalResult.count ?? 0}
          icon="✚"
        />
        <StatCard
          label="공공 병원"
          value={publicResult.count ?? 0}
          icon="D"
          tone="blue"
        />
        <StatCard
          label="제휴 병원"
          value={partnerResult.count ?? 0}
          icon="P"
          tone="green"
        />
        <StatCard
          label="비활성 병원"
          value={inactiveResult.count ?? 0}
          icon="!"
          tone="red"
        />
        <StatCard
          label="좌표 미생성"
          value={missingCoordinatesResult.count ?? 0}
          icon="⌖"
          tone="amber"
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          action="/admin/hospitals"
          method="get"
          className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_160px_170px_auto]"
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="병원명 또는 주소 검색"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-950"
          />

          <select
            name="source"
            defaultValue={source}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option value="all">전체 유형</option>
            <option value="public_data">공공데이터</option>
            <option value="pawu_partner">PAWU 제휴</option>
          </select>

          <select
            name="status"
            defaultValue={status}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option value="all">전체 상태</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>

          <select
            name="coordinates"
            defaultValue={coordinates}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option value="all">좌표 전체</option>
            <option value="ready">좌표 생성 완료</option>
            <option value="missing">좌표 미생성</option>
          </select>

          <button
            type="submit"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
          >
            검색
          </button>
        </form>
      </section>

      {listResult.error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          병원 목록을 불러오지 못했습니다.
          <p className="mt-2 text-xs">
            {listResult.error.message}
          </p>
        </div>
      )}

      {!listResult.error && (
        <HospitalTable
          hospitals={hospitals}
          resultCount={resultCount}
          page={page}
          totalPages={totalPages}
          searchParams={{
            q,
            source,
            status,
            coordinates,
          }}
        />
      )}
    </div>
  );
}
