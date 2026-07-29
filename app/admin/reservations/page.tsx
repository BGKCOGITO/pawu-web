import Link from "next/link";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import AdminHeader from "../../../components/admin/AdminHeader";
import { updateReservationStatus } from "../actions";

export const dynamic = "force-dynamic";

type PetInfo = {
  id: number;
  name: string;
  species: "dog" | "cat" | "other";
  breed: string | null;
  gender: "male" | "female" | "unknown" | null;
  weight_kg: number | null;
};

type HospitalInfo = {
  id: number;
  name: string;
};

type PreparationInfo = {
  id: number;
  generated_summary: string | null;
};

type Reservation = {
  id: number;
  hospital_id: number;
  pet_id: number | null;
  pet_name: string;
  guardian_name: string;
  phone: string;
  reservation_date: string;
  reservation_time: string;
  visit_reason: string;
  symptoms: string | null;
  status: string;
  created_at: string;
  pets: PetInfo | PetInfo[] | null;
  hospitals: HospitalInfo | HospitalInfo[] | null;
  visit_preparations: PreparationInfo | PreparationInfo[] | null;
};

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getStatusLabel(status: string) {
  if (status === "requested") return "승인 대기";
  if (status === "approved") return "예약 승인";
  if (status === "rejected") return "예약 거절";
  if (status === "cancelled") return "예약 취소";
  if (status === "completed") return "진료 완료";
  return status;
}

function getStatusClass(status: string) {
  if (status === "approved") return "bg-green-100 text-green-800";
  if (status === "rejected") return "bg-red-100 text-red-800";
  if (status === "cancelled") return "bg-gray-100 text-gray-600";
  if (status === "completed") return "bg-blue-100 text-blue-800";
  return "bg-yellow-100 text-yellow-800";
}

export default async function AdminReservationsPage() {
  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select(`
      id,hospital_id,pet_id,pet_name,guardian_name,phone,
      reservation_date,reservation_time,visit_reason,symptoms,status,created_at,
      pets(id,name,species,breed,gender,weight_kg),
      hospitals(id,name),
      visit_preparations(id,generated_summary)
    `)
    .order("created_at", { ascending: false });

  const reservations = (data ?? []) as unknown as Reservation[];

  return (
    <div>
      <AdminHeader
        title="예약 요청 관리"
        description="예약 내용과 보호자가 함께 보낸 건강기록을 확인합니다."
      />

      <section className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-black">전체 예약 요청</h2>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-sm font-bold text-white">
          {reservations.length}건
        </span>
      </section>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          예약 목록을 불러오지 못했습니다.
          <p className="mt-2 text-xs">{error.message}</p>
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {reservations.map((reservation) => {
          const pet = one(reservation.pets);
          const hospital = one(reservation.hospitals);
          const preparation = one(reservation.visit_preparations);

          return (
            <article
              key={reservation.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">
                    예약번호 #{reservation.id}
                  </p>
                  <h3 className="mt-1 text-xl font-black">
                    {pet?.name ?? reservation.pet_name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {hospital?.name ?? `병원 #${reservation.hospital_id}`}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                    reservation.status,
                  )}`}
                >
                  {getStatusLabel(reservation.status)}
                </span>
              </div>

              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-400">보호자</dt>
                  <dd className="font-semibold">{reservation.guardian_name}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">예약 일시</dt>
                  <dd className="font-semibold">
                    {reservation.reservation_date}{" "}
                    {reservation.reservation_time.slice(0, 5)}
                  </dd>
                </div>
              </dl>

              <section
                className={`mt-5 rounded-2xl p-4 ${
                  preparation ? "bg-emerald-50" : "bg-slate-100"
                }`}
              >
                <p className="text-sm font-bold">
                  {preparation
                    ? "건강기록이 함께 전달된 예약"
                    : "일반 예약"}
                </p>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {preparation?.generated_summary ??
                    reservation.symptoms ??
                    "작성된 증상 및 요청사항이 없습니다."}
                </p>
              </section>

              <Link
                href={`/admin/reservations/${reservation.id}`}
                className="mt-5 block w-full rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white"
              >
                예약 상세 보기
              </Link>

              {reservation.status === "requested" && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <form action={updateReservationStatus}>
                    <input type="hidden" name="reservationId" value={reservation.id} />
                    <input type="hidden" name="status" value="approved" />
                    <button className="w-full rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
                      바로 승인
                    </button>
                  </form>

                  <form action={updateReservationStatus}>
                    <input type="hidden" name="reservationId" value={reservation.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button className="w-full rounded-2xl border border-red-300 bg-white px-4 py-3 text-sm font-bold text-red-600">
                      예약 거절
                    </button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
