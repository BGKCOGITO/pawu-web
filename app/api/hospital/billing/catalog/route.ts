import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import { can, getHospitalAccess, readBearer } from "../../../../../lib/hospital-access";

export async function GET(request: Request) {
  const access = await getHospitalAccess(readBearer(request));
  if (!access) return NextResponse.json({ ok: false, message: "병원 로그인이 필요합니다." }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("hospital_service_items").select("*").eq("hospital_id", access.hospitalId).order("is_favorite", { ascending: false }).order("category").order("sort_order").order("name");
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const access = await getHospitalAccess(readBearer(request));
  if (!access || !can(access, "manage_billing_catalog")) return NextResponse.json({ ok: false, message: "진료 항목 관리 권한이 없습니다." }, { status: 403 });
  const body = await request.json() as { name?: string; category?: string; defaultPrice?: number; description?: string; speciesScope?: string; isFavorite?: boolean };
  const name = String(body.name ?? "").trim();
  const category = String(body.category ?? "").trim();
  const defaultPrice = Math.round(Number(body.defaultPrice));
  if (!name || !category || !Number.isFinite(defaultPrice) || defaultPrice < 0) return NextResponse.json({ ok: false, message: "항목명, 분류, 기본 금액을 확인해 주세요." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("hospital_service_items").insert({ hospital_id: access.hospitalId, name, category, default_price: defaultPrice, description: String(body.description ?? "").trim() || null, species_scope: ["all","dog","cat","other"].includes(String(body.speciesScope)) ? body.speciesScope : "all", is_favorite: body.isFavorite === true, created_by: access.userId }).select("*").single();
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(request: Request) {
  const access = await getHospitalAccess(readBearer(request));
  if (!access || !can(access, "manage_billing_catalog")) return NextResponse.json({ ok: false, message: "진료 항목 관리 권한이 없습니다." }, { status: 403 });
  const body = await request.json() as { id?: number; name?: string; category?: string; defaultPrice?: number; description?: string | null; speciesScope?: string; isFavorite?: boolean; isActive?: boolean };
  const id = Number(body.id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, message: "항목 정보가 올바르지 않습니다." }, { status: 400 });
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.category !== undefined) update.category = body.category.trim();
  if (body.defaultPrice !== undefined) update.default_price = Math.max(0, Math.round(Number(body.defaultPrice)));
  if (body.description !== undefined) update.description = body.description;
  if (body.speciesScope !== undefined) update.species_scope = body.speciesScope;
  if (body.isFavorite !== undefined) update.is_favorite = body.isFavorite;
  if (body.isActive !== undefined) update.is_active = body.isActive;
  const { error } = await supabaseAdmin.from("hospital_service_items").update(update).eq("id", id).eq("hospital_id", access.hospitalId);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
