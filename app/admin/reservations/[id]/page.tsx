import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import AdminHeader from "../../../../components/admin/AdminHeader";
import { updateReservationStatus } from "../../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function speciesLabel(value: string | null | undefined) {
  if (value === "dog") return "강아지";
  if (value === "cat") return "고양이";
  if (value === "other") return "기타";
  return "미입력";
}

function genderLabel(value: string | null | undefined) {
  if (value === "male") return "수컷";
  if (value === "female") return "암컷";
  return "미입력";
}

function boolLabel(value: boolean | null | undefined) {
  if (value === true) return "완료";
  if (value === false) return "미완료";
  return "미입력";
}

export default async function AdminReservationDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const reservationId = Number(id);

  if (!Number.isInteger(reservationId)) notFound();

  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select(`
      id,hospital_id,pet_id,pet_name,guardian_name,phone,
      reservation_date,reservation_time,visit_reason,symptoms,status,created_at,
      pets(
        id,name,species,breed,birth_date,gender,weight_kg,notes,
        pet_lifestyle_profiles(
          food_brand,food_product,feeding_type,feeding_times_per_day,
          feeding_amount_per_day_g,treats,allergies,current_medications,
          supplements,neutered,living_environment,notes,
          pet_food_brands(name_ko),
          pet_food_products(name_ko)
        )
      ),
      hospitals(id,name,address,phone),
      visit_preparations(
        id,main_concern,generated_summary,generated_timeline,
        generated_key_points,generated_at,
        visit_preparation_events(
          sort_order,
          pet_health_events(
            id,occurred_at,event_type,title,severity,priority,
            count_value,note,
            pet_health_event_attachments(
              id,storage_path,file_name,mime_type,media_type,sort_order
            )
          )
        )
      )
    `)
    .eq("id", reservationId)
    .single();

  if (error || !data) notFound();

  const reservation = data as any;
  const pet = one(reservation.pets);
  const hospital = one(reservation.hospitals);
  const lifestyle = one(pet?.pet_lifestyle_profiles);
  const preparation = one(reservation.visit_preparations);

  const linkedEvents = (
    (preparation?.visit_preparation_events ?? []) as any[]
  )
    .map((row) => ({
      sortOrder: row.sort_order,
      event: one(row.pet_health_events),
    }))
    .filter((row) => row.event)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const attachments = linkedEvents.flatMap(({ event }) =>
    ((event.pet_health_event_attachments ?? []) as any[]).map(
      (attachment) => ({
        ...attachment,
        eventId: event.id,
      }),
    ),
  );

  const signedUrlMap = new Map<number, string>();

  await Promise.all(
    attachments.map(async (attachment) => {
      const { data: signed } = await supabaseAdmin.storage
        .from("pet-health-events")
        .createSignedUrl(attachment.storage_path, 60 * 60);

      if (signed?.signedUrl) {
        signedUrlMap.set(attachment.id, signed.signedUrl);
      }
    }),
  );

  const foodBrand =
    one(lifestyle?.pet_food_brands)?.name_ko ??
    lifestyle?.food_brand ??
    "미입력";
  const foodProduct =
    one(lifestyle?.pet_food_products)?.name_ko ??
    lifestyle?.food_product ??
    "미입력";

  return (
    <div>
      <AdminHeader
        title={`예약 상세 #${reservation.id}`}
        description="보호자가 전달한 예약 정보, 생활정보, 건강 타임라인과 미디어를 확인합니다."
      />

      <Link
        href="/admin/reservations"
        className="mt-5 inline-block text-sm font-bold text-slate-600"
      >
        ← 예약 목록으로
      </Link>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <article className="rounded-3xl border bg-white p-6">
          <p className="text-sm font-bold text-slate-400">예약</p>
          <h2 className="mt-2 text-xl font-black">
            {reservation.reservation_date}{" "}
            {reservation.reservation_time.slice(0, 5)}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {hospital?.name ?? `병원 #${reservation.hospital_id}`}
          </p>
        </article>

        <article className="rounded-3xl border bg-white p-6">
          <p className="text-sm font-bold text-slate-400">보호자</p>
          <h2 className="mt-2 text-xl font-black">
            {reservation.guardian_name}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{reservation.phone}</p>
        </article>

        <article className="rounded-3xl border bg-white p-6">
          <p className="text-sm font-bold text-slate-400">반려동물</p>
          <h2 className="mt-2 text-xl font-black">
            {pet?.name ?? reservation.pet_name}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {speciesLabel(pet?.species)}
            {pet?.breed ? ` · ${pet.breed}` : ""}
          </p>
        </article>
      </section>

      <section className="mt-5 rounded-3xl border bg-white p-6">
        <h2 className="text-xl font-black">반려동물 기본정보</h2>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-slate-400">성별</dt><dd className="mt-1 font-bold">{genderLabel(pet?.gender)}</dd></div>
          <div><dt className="text-slate-400">몸무게</dt><dd className="mt-1 font-bold">{pet?.weight_kg != null ? `${pet.weight_kg}kg` : "미입력"}</dd></div>
          <div><dt className="text-slate-400">생년월일</dt><dd className="mt-1 font-bold">{pet?.birth_date ?? "미입력"}</dd></div>
          <div><dt className="text-slate-400">중성화</dt><dd className="mt-1 font-bold">{boolLabel(lifestyle?.neutered)}</dd></div>
        </dl>
      </section>

      <section className="mt-5 rounded-3xl border bg-white p-6">
        <h2 className="text-xl font-black">생활정보</h2>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-slate-400">사료</dt><dd className="mt-1 font-bold">{foodBrand} · {foodProduct}</dd></div>
          <div><dt className="text-slate-400">급여 방식</dt><dd className="mt-1 font-bold">{lifestyle?.feeding_type === "free" ? "자율급식" : lifestyle?.feeding_times_per_day ? `하루 ${lifestyle.feeding_times_per_day}회` : "미입력"}</dd></div>
          <div><dt className="text-slate-400">급여량</dt><dd className="mt-1 font-bold">{lifestyle?.feeding_amount_per_day_g != null ? `${lifestyle.feeding_amount_per_day_g}g/일` : "미입력"}</dd></div>
          <div><dt className="text-slate-400">알레르기</dt><dd className="mt-1 font-bold">{lifestyle?.allergies || "없음 또는 미입력"}</dd></div>
          <div><dt className="text-slate-400">복용약</dt><dd className="mt-1 font-bold">{lifestyle?.current_medications || "없음 또는 미입력"}</dd></div>
          <div><dt className="text-slate-400">영양제</dt><dd className="mt-1 font-bold">{lifestyle?.supplements || "없음 또는 미입력"}</dd></div>
        </dl>
      </section>

      <section className="mt-5 rounded-3xl bg-slate-950 p-6 text-white">
        <p className="text-sm font-bold text-white/60">PAWU 사전 요약</p>
        <h2 className="mt-2 text-2xl font-black">
          {preparation ? "진료 준비 자료" : "일반 예약"}
        </h2>

        {preparation ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold text-amber-300">특이사항</p>
              <p className="mt-2 whitespace-pre-wrap leading-7">
                {preparation.main_concern || "입력된 특이사항 없음"}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-300">요약</p>
              <p className="mt-2 whitespace-pre-wrap leading-7">
                {preparation.generated_summary || "생성된 요약 없음"}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 whitespace-pre-wrap leading-7 text-white/80">
            {reservation.symptoms || "전달된 증상 및 건강기록이 없습니다."}
          </p>
        )}
      </section>

      {preparation && (
        <section className="mt-5 rounded-3xl border bg-white p-6">
          <h2 className="text-xl font-black">건강 이벤트 타임라인</h2>

          {linkedEvents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              선택된 건강 이벤트는 없으며 특이사항만 전달된 예약입니다.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {linkedEvents.map(({ event }) => {
                const eventAttachments = attachments.filter(
                  (attachment) => attachment.eventId === event.id,
                );

                return (
                  <article
                    key={event.id}
                    className="rounded-2xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-rose-500">
                          {new Date(event.occurred_at).toLocaleString("ko-KR")}
                        </p>
                        <h3 className="mt-1 text-lg font-black">
                          {event.title}
                          {event.count_value ? ` · ${event.count_value}회` : ""}
                        </h3>
                      </div>
                      <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
                        {event.priority === "emergency"
                          ? "응급"
                          : event.priority === "high"
                            ? "높음"
                            : event.priority === "reference"
                              ? "참고"
                              : "보통"}
                      </span>
                    </div>

                    {event.note && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                        {event.note}
                      </p>
                    )}

                    {eventAttachments.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {eventAttachments.map((attachment) => {
                          const url = signedUrlMap.get(attachment.id);

                          return (
                            <div
                              key={attachment.id}
                              className="overflow-hidden rounded-2xl bg-slate-100"
                            >
                              {url && attachment.media_type === "video" ? (
                                <video
                                  src={url}
                                  controls
                                  className="aspect-square w-full object-cover"
                                />
                              ) : url ? (
                                <img
                                  src={url}
                                  alt={attachment.file_name}
                                  className="aspect-square w-full object-cover"
                                />
                              ) : (
                                <div className="flex aspect-square items-center justify-center text-xs text-slate-400">
                                  미리보기 실패
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="mt-5 rounded-3xl border bg-white p-6">
        <h2 className="text-xl font-black">예약 상태 처리</h2>

        {reservation.status === "requested" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <form action={updateReservationStatus}>
              <input type="hidden" name="reservationId" value={reservation.id} />
              <input type="hidden" name="status" value="approved" />
              <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white">
                예약 승인
              </button>
            </form>
            <form action={updateReservationStatus}>
              <input type="hidden" name="reservationId" value={reservation.id} />
              <input type="hidden" name="status" value="rejected" />
              <button className="w-full rounded-2xl border border-red-300 px-4 py-3 font-bold text-red-600">
                예약 거절
              </button>
            </form>
          </div>
        )}

        {reservation.status === "approved" && (
          <form action={updateReservationStatus} className="mt-5">
            <input type="hidden" name="reservationId" value={reservation.id} />
            <input type="hidden" name="status" value="completed" />
            <button className="w-full rounded-2xl bg-blue-50 px-4 py-3 font-bold text-blue-700">
              진료 완료 처리
            </button>
          </form>
        )}

        {!["requested", "approved"].includes(reservation.status) && (
          <p className="mt-4 text-sm text-slate-500">
            현재 상태: {reservation.status}
          </p>
        )}
      </section>
    </div>
  );
}
