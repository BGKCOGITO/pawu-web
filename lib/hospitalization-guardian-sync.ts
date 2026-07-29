import { supabaseAdmin } from "@/lib/supabase-admin";

export type HospitalizationGuardianContext = {
  hospitalizationId: number;
  hospitalId: number;
  guardianUserId: string | null;
  petId: number | null;
  petName: string;
  hospitalName: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function resolveHospitalizationGuardianContext(
  hospitalizationId: number,
  hospitalId: number,
): Promise<HospitalizationGuardianContext | null> {
  const { data, error } = await supabaseAdmin
    .from("hospitalizations")
    .select(`
      id,
      hospital_id,
      reservation_id,
      hospitals(name),
      reservations(id, user_id),
      hospital_patients(
        pet_id,
        pets(id, name, user_id)
      )
    `)
    .eq("id", hospitalizationId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();

  if (error || !data) return null;

  const hospital = one(data.hospitals as any);
  const reservation = one(data.reservations as any);
  const patient = one(data.hospital_patients as any);
  const pet = one(patient?.pets);

  return {
    hospitalizationId,
    hospitalId,
    guardianUserId: reservation?.user_id ?? pet?.user_id ?? null,
    petId: pet?.id ?? patient?.pet_id ?? null,
    petName: pet?.name ?? "반려동물",
    hospitalName: hospital?.name ?? "동물병원",
  };
}

export async function publishHospitalizationStatusToGuardian({
  context,
  status,
  actorUserId,
  occurredAt = new Date().toISOString(),
}: {
  context: HospitalizationGuardianContext;
  status: "admitted" | "discharged";
  actorUserId: string;
  occurredAt?: string;
}) {
  if (!context.guardianUserId) {
    return { published: false, reason: "guardian_not_found" as const };
  }

  const isAdmission = status === "admitted";
  const category = isAdmission ? "general" : "discharge";
  const title = isAdmission
    ? `${context.petName} 입원 안내`
    : `${context.petName} 퇴원 완료`;
  const message = isAdmission
    ? `${context.petName}가 ${context.hospitalName}에 입원했습니다. 입원 경과 화면에서 병원이 공유하는 치료 소식을 확인할 수 있습니다.`
    : `${context.petName}의 퇴원 처리가 완료되었습니다. 입원 경과 화면에서 입원 기간과 퇴원 기록을 확인할 수 있습니다.`;
  const notificationType = isAdmission
    ? "hospitalization_admitted"
    : "hospitalization_discharged";

  const { data: existing } = await supabaseAdmin
    .from("hospitalization_guardian_updates")
    .select("id")
    .eq("hospitalization_id", context.hospitalizationId)
    .eq("guardian_user_id", context.guardianUserId)
    .eq("category", category)
    .eq("title", title)
    .is("retracted_at", null)
    .limit(1)
    .maybeSingle();

  if (!existing) {
    const { error: updateError } = await supabaseAdmin
      .from("hospitalization_guardian_updates")
      .insert({
        hospital_id: context.hospitalId,
        hospitalization_id: context.hospitalizationId,
        pet_id: context.petId,
        guardian_user_id: context.guardianUserId,
        category,
        title,
        message,
        published_at: occurredAt,
        created_by: actorUserId,
      });

    if (updateError) {
      return {
        published: false,
        reason: "guardian_update_failed" as const,
        error: updateError.message,
      };
    }
  }

  const { data: existingNotification } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("user_id", context.guardianUserId)
    .eq("type", notificationType)
    .contains("metadata", { hospitalization_id: context.hospitalizationId })
    .limit(1)
    .maybeSingle();

  if (!existingNotification) {
    const { error: notificationError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: context.guardianUserId,
        type: notificationType,
        title,
        body: message,
        link_url: "/inpatient-updates",
        metadata: {
          hospitalization_id: context.hospitalizationId,
          hospital_id: context.hospitalId,
          pet_id: context.petId,
          status,
        },
      });

    if (notificationError) {
      return {
        published: false,
        reason: "notification_failed" as const,
        error: notificationError.message,
      };
    }
  }

  await supabaseAdmin.from("hospitalization_events").insert({
    hospitalization_id: context.hospitalizationId,
    event_type: "guardian_update",
    occurred_at: occurredAt,
    title,
    content: message,
    is_guardian_visible: true,
    guardian_message: message,
    created_by: actorUserId,
  });

  return { published: true as const };
}
