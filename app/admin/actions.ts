"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "../../lib/supabase-admin";

const allowedStatuses = [
  "approved",
  "rejected",
  "completed",
  "cancelled",
] as const;

type AllowedStatus = (typeof allowedStatuses)[number];

export async function updateReservationStatus(
  formData: FormData
) {
  const reservationId = Number(
    formData.get("reservationId")
  );

  const status = String(
    formData.get("status") ?? ""
  ) as AllowedStatus;

  if (!Number.isInteger(reservationId)) {
    throw new Error("예약 번호가 올바르지 않습니다.");
  }

  if (!allowedStatuses.includes(status)) {
    throw new Error("예약 상태가 올바르지 않습니다.");
  }

  const { error } = await supabaseAdmin
    .from("reservations")
    .update({
      status,
    })
    .eq("id", reservationId);

  if (error) {
    console.error("예약 상태 변경 오류:", error);

    throw new Error(
      "예약 상태를 변경하지 못했습니다."
    );
  }

  revalidatePath("/admin");
}