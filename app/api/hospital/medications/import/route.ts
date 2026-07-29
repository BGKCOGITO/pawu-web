import { NextResponse } from "next/server";
import { requirePrescriptionAccess } from "../../../../../lib/v6-5-prescription-access";

type ImportRow = {
  sourceCode?: string;
  sourceItemId?: string;
  productNameKo?: string;
  productNameEn?: string;
  ingredientNameKo?: string;
  ingredientNameEn?: string;
  manufacturerName?: string;
  dosageForm?: string;
  strengthText?: string;
  routeHint?: string;
  medicationCategory?: string;
  isAnesthetic?: boolean;
  isControlled?: boolean;
  approvalStatus?: string;
  approvalNumber?: string;
  sourceUrl?: string;
};

export async function POST(request: Request) {
  const auth = await requirePrescriptionAccess(request, "finalize_prescription");
  if (!auth.ok || !["owner", "veterinarian"].includes(auth.access.role)) {
    return NextResponse.json({ ok: false, message: "약품 DB 가져오기 권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json();
  const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length || rows.length > 1000) {
    return NextResponse.json({ ok: false, message: "1회 1~1000건만 가져올 수 있습니다." }, { status: 400 });
  }

  const payload = rows
    .filter((row) => String(row.productNameKo ?? "").trim())
    .map((row) => ({
      source_code: String(row.sourceCode ?? "manual-import").trim(),
      source_item_id: String(row.sourceItemId ?? crypto.randomUUID()).trim(),
      product_name_ko: String(row.productNameKo ?? "").trim(),
      product_name_en: String(row.productNameEn ?? "").trim() || null,
      ingredient_name_ko: String(row.ingredientNameKo ?? "").trim() || null,
      ingredient_name_en: String(row.ingredientNameEn ?? "").trim() || null,
      manufacturer_name: String(row.manufacturerName ?? "").trim() || null,
      dosage_form: String(row.dosageForm ?? "").trim() || null,
      strength_text: String(row.strengthText ?? "").trim() || null,
      route_hint: String(row.routeHint ?? "").trim() || null,
      medication_category: String(row.medicationCategory ?? "").trim() || null,
      is_anesthetic: row.isAnesthetic === true,
      is_controlled: row.isControlled === true,
      approval_status: String(row.approvalStatus ?? "").trim() || null,
      approval_number: String(row.approvalNumber ?? "").trim() || null,
      source_url: String(row.sourceUrl ?? "").trim() || null,
      source_updated_at: new Date().toISOString(),
      raw_payload: row,
      updated_at: new Date().toISOString(),
    }));

  const { error } = await auth.supabaseAdmin
    .from("central_medications")
    .upsert(payload, { onConflict: "source_code,source_item_id" });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, imported: payload.length });
}
