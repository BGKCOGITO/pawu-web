import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../lib/v5-access";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export async function GET(request: Request) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const petId = Number(url.searchParams.get("petId"));

  let query = supabaseAdmin
    .from("lab_orders")
    .select(`
      id, pet_id, category, test_name, status,
      guardian_summary, finalized_at, created_at,
      hospitals(name, phone, address),
      pets!inner(id, name, user_id),
      lab_result_values(
        id, analyte_name, result_value, result_text, unit,
        reference_low, reference_high, reference_text,
        abnormal_flag, sort_order
      ),
      lab_attachments(
        id, file_name, file_path, mime_type, attachment_type
      )
    `)
    .eq("pets.user_id", user.id)
    .eq("status", "finalized")
    .eq("guardian_visible", true)
    .order("finalized_at", { ascending: false });

  if (Number.isInteger(petId)) query = query.eq("pet_id", petId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  const records = [];
  for (const order of data ?? []) {
    const attachments = [];
    for (const attachment of order.lab_attachments ?? []) {
      const { data: signed } = await supabaseAdmin.storage
        .from("lab-results")
        .createSignedUrl(attachment.file_path, 60 * 10);

      attachments.push({
        ...attachment,
        signedUrl: signed?.signedUrl ?? null,
      });
    }

    records.push({ ...order, lab_attachments: attachments });
  }

  return NextResponse.json({ ok: true, results: records });
}
