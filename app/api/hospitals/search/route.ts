import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { TtlCache } from "@/lib/server/ttl-cache";

const searchCache = new TtlCache<any>({ ttlMs: 60_000, maxEntries: 400 });
const SELECT = "id,name,address,phone,latitude,longitude,reservation_enabled,animal_types,service_codes,parking_available,night_care_available,emergency_care_available,business_status,detailed_business_status,source_type";

function clean(value: string | null, max = 80) {
  return (value ?? "").trim().replace(/[%_,()]/g, "").slice(0, max);
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const sp = req.nextUrl.searchParams;
  const q = clean(sp.get("q"));
  const region = clean(sp.get("region"), 40);
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.get("limit") ?? "50", 10) || 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const cacheKey = JSON.stringify({ q: q.toLowerCase(), region: region.toLowerCase(), page, limit });
  const cached = searchCache.get(cacheKey);

  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
        "X-PAWU-Cache": "HIT",
        "Server-Timing": `total;dur=${Date.now() - startedAt}`,
      },
    });
  }

  let query = supabaseAdmin
    .from("hospitals")
    .select(SELECT, { count: "exact" })
    .eq("is_active", true)
    .eq("is_published", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("name")
    .range(from, to);

  if (q) query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%,road_address.ilike.%${q}%,lot_address.ilike.%${q}%,phone.ilike.%${q}%,region_level1.ilike.%${q}%,region_level2.ilike.%${q}%`);
  if (region) query = query.or(`region_level1.ilike.%${region}%,region_level2.ilike.%${region}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const payload = {
    hospitals: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
      hasNext: to + 1 < (count ?? 0),
    },
  };
  searchCache.set(cacheKey, payload);

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      "X-PAWU-Cache": "MISS",
      "Server-Timing": `db;dur=${Date.now() - startedAt}, total;dur=${Date.now() - startedAt}`,
    },
  });
}
