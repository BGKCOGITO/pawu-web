import { supabase } from "@/lib/supabase";

export type CachedMapHospital = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  reservation_enabled: boolean;
  parking_available?: boolean | null;
  night_care_available?: boolean | null;
  emergency_care_available?: boolean | null;
  is_active: boolean;
  source_type: "public_data" | "pawu_partner";
};

const SELECT_COLUMNS =
  "id,name,address,phone,latitude,longitude,reservation_enabled,parking_available,night_care_available,emergency_care_available,is_active,source_type";
const CACHE_KEY = "pawu:hospital-map:v982";
const CACHE_TTL_MS = 10 * 60_000;

type CachePayload = { savedAt: number; hospitals: CachedMapHospital[] };
let memoryCache: CachePayload | null = null;
let inFlight: Promise<CachedMapHospital[]> | null = null;

function isValid(payload: CachePayload | null): payload is CachePayload {
  return Boolean(payload && Date.now() - payload.savedAt < CACHE_TTL_MS);
}

function readSessionCache(): CachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as CachePayload;
    if (!isValid(payload)) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return payload;
  } catch {
    try {
      window.sessionStorage.removeItem(CACHE_KEY);
    } catch {}
    return null;
  }
}

function writeSessionCache(payload: CachePayload) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // 일부 모바일 브라우저의 저장공간 제한에서는 메모리 캐시만 사용합니다.
  }
}

export async function getHospitalMapRows(force = false): Promise<CachedMapHospital[]> {
  if (!force && isValid(memoryCache)) return memoryCache.hospitals;

  if (!force) {
    const stored = readSessionCache();
    if (stored) {
      memoryCache = stored;
      return stored.hospitals;
    }
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    const { data, error } = await supabase
      .from("hospitals")
      .select(SELECT_COLUMNS)
      .eq("is_active", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(12000);

    if (error) throw error;

    const hospitals = ((data ?? []) as CachedMapHospital[]).filter(
      (hospital) =>
        Number.isFinite(Number(hospital.latitude)) &&
        Number.isFinite(Number(hospital.longitude)),
    );
    const payload = { savedAt: Date.now(), hospitals };
    memoryCache = payload;
    writeSessionCache(payload);
    return hospitals;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
