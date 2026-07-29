import Link from "next/link";

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

type HospitalTableProps = {
  hospitals: Hospital[];
  resultCount: number;
  page: number;
  totalPages: number;
  searchParams: {
    q: string;
    source: string;
    status: string;
    coordinates: string;
  };
};

function hasCoordinates(hospital: Hospital) {
  return Boolean(
    hospital.latitude &&
      hospital.longitude &&
      hospital.latitude !== 0 &&
      hospital.longitude !== 0
  );
}

function createPageHref(
  searchParams: HospitalTableProps["searchParams"],
  page: number
) {
  const params = new URLSearchParams();

  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.source)
    params.set("source", searchParams.source);
  if (searchParams.status)
    params.set("status", searchParams.status);
  if (searchParams.coordinates)
    params.set("coordinates", searchParams.coordinates);

  params.set("page", String(page));

  return `/admin/hospitals?${params.toString()}`;
}

export default function HospitalTable({
  hospitals,
  resultCount,
  page,
  totalPages,
  searchParams,
}: HospitalTableProps) {
  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-black">병원 목록</h2>
          <p className="mt-1 text-xs text-slate-500">
            검색 결과 {resultCount.toLocaleString("ko-KR")}개
          </p>
        </div>
      </div>

      {hospitals.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          조건에 맞는 병원이 없습니다.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">
                    병원
                  </th>
                  <th className="px-5 py-4 font-semibold">
                    유형
                  </th>
                  <th className="px-5 py-4 font-semibold">
                    상태
                  </th>
                  <th className="px-5 py-4 font-semibold">
                    좌표
                  </th>
                  <th className="px-5 py-4 font-semibold">
                    예약
                  </th>
                  <th className="px-5 py-4 font-semibold">
                    최근 공공데이터
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {hospitals.map((hospital) => (
                  <tr key={hospital.id} className="align-top">
                    <td className="px-5 py-4">
                      <p className="font-bold">{hospital.name}</p>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                        {hospital.road_address ||
                          hospital.address ||
                          hospital.lot_address ||
                          "주소 없음"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                          hospital.source_type === "pawu_partner"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-blue-100 text-blue-700",
                        ].join(" ")}
                      >
                        {hospital.source_type === "pawu_partner"
                          ? "PAWU 제휴"
                          : "공공데이터"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                          hospital.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700",
                        ].join(" ")}
                      >
                        {hospital.is_active ? "활성" : "비활성"}
                      </span>

                      <p className="mt-2 text-xs text-slate-500">
                        {hospital.detailed_business_status ||
                          hospital.business_status ||
                          "-"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                          hasCoordinates(hospital)
                            ? "bg-slate-100 text-slate-700"
                            : "bg-amber-100 text-amber-700",
                        ].join(" ")}
                      >
                        {hasCoordinates(hospital)
                          ? "생성 완료"
                          : "미생성"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                          hospital.reservation_enabled
                            ? "bg-slate-950 text-white"
                            : "bg-slate-100 text-slate-500",
                        ].join(" ")}
                      >
                        {hospital.reservation_enabled
                          ? "예약 가능"
                          : "예약 불가"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-500">
                      {hospital.public_data_updated_at
                        ? new Date(
                            hospital.public_data_updated_at
                          ).toLocaleDateString("ko-KR")
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {hospitals.map((hospital) => (
              <article key={hospital.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black">{hospital.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {hospital.road_address ||
                        hospital.address ||
                        hospital.lot_address ||
                        "주소 없음"}
                    </p>
                  </div>

                  <span
                    className={[
                      "shrink-0 rounded-full px-3 py-1 text-xs font-bold",
                      hospital.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700",
                    ].join(" ")}
                  >
                    {hospital.is_active ? "활성" : "비활성"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {hospital.source_type === "pawu_partner"
                      ? "PAWU 제휴"
                      : "공공데이터"}
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {hasCoordinates(hospital)
                      ? "좌표 완료"
                      : "좌표 미생성"}
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {hospital.reservation_enabled
                      ? "예약 가능"
                      : "예약 불가"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
        <Link
          href={createPageHref(
            searchParams,
            Math.max(1, page - 1)
          )}
          aria-disabled={page <= 1}
          className={[
            "rounded-xl border px-4 py-2 text-sm font-bold",
            page <= 1
              ? "pointer-events-none border-slate-100 text-slate-300"
              : "border-slate-200 text-slate-700",
          ].join(" ")}
        >
          이전
        </Link>

        <p className="text-sm text-slate-500">
          {page} / {totalPages}
        </p>

        <Link
          href={createPageHref(
            searchParams,
            Math.min(totalPages, page + 1)
          )}
          aria-disabled={page >= totalPages}
          className={[
            "rounded-xl border px-4 py-2 text-sm font-bold",
            page >= totalPages
              ? "pointer-events-none border-slate-100 text-slate-300"
              : "border-slate-200 text-slate-700",
          ].join(" ")}
        >
          다음
        </Link>
      </div>
    </section>
  );
}
