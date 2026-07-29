import { NextResponse } from "next/server";
import { requirePrescriptionAccess } from "../../../../../lib/v6-5-prescription-access";

export async function GET(request: Request) {
  const auth = await requirePrescriptionAccess(request, "view_prescription");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30), 1), 50);

  if (q.length < 2) {
    return NextResponse.json({ ok: true, medications: [] });
  }

  const escaped = q.replace(/[%_]/g, "");
  const { data, error } = await auth.supabaseAdmin
    .from("central_medications")
    .select("id, product_name_ko, product_name_en, ingredient_name_ko, ingredient_name_en, manufacturer_name, dosage_form, strength_text, route_hint, medication_category, is_anesthetic, is_controlled, approval_status")
    .or([
      `product_name_ko.ilike.%${escaped}%`,
      `product_name_en.ilike.%${escaped}%`,
      `ingredient_name_ko.ilike.%${escaped}%`,
      `ingredient_name_en.ilike.%${escaped}%`,
      `manufacturer_name.ilike.%${escaped}%`,
    ].join(","))
    .order("product_name_ko")
    .limit(limit);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, medications: data ?? [] });
}
