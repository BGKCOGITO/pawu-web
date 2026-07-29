import { createClient } from "@supabase/supabase-js";

const {
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  NAVER_GEOCODING_CLIENT_ID: naverClientId,
  NAVER_GEOCODING_CLIENT_SECRET: naverClientSecret,
} = process.env;

if (!supabaseUrl || !serviceRoleKey || !naverClientId || !naverClientSecret) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NAVER_GEOCODING_CLIENT_ID, NAVER_GEOCODING_CLIENT_SECRET가 필요합니다."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const args = process.argv.slice(2);
const numericLimit = args.find((value) => /^\d+$/.test(value));
const runAll = args.includes("--all");
const retryFailed = args.includes("--retry-failed");
const activeOnly = args.includes("--active-only");

const totalLimit = runAll
  ? Number.POSITIVE_INFINITY
  : Math.max(1, Number(numericLimit ?? 100));

const BATCH_SIZE = 100;
const REQUEST_DELAY_MS = 140;
const BATCH_DELAY_MS = 2_000;
const MAX_HTTP_RETRIES = 4;

let stopRequested = false;
process.on("SIGINT", () => {
  if (!stopRequested) {
    stopRequested = true;
    console.log("\n중단 요청을 받았습니다. 현재 병원 처리 후 안전하게 종료합니다.");
  } else {
    process.exit(130);
  }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildAddress(hospital) {
  return [hospital.road_address, hospital.address, hospital.lot_address]
    .map((value) => value?.trim())
    .find(Boolean);
}

function buildEligibleQuery({ countOnly = false } = {}) {
  let query = supabase
    .from("hospitals")
    .select(
      countOnly ? "id" : "id,name,address,road_address,lot_address,geocode_status",
      countOnly ? { count: "exact", head: true } : undefined
    )
    .or("latitude.is.null,longitude.is.null");

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const statuses = retryFailed
    ? "geocode_status.is.null,geocode_status.eq.pending,geocode_status.eq.retry,geocode_status.eq.processing,geocode_status.eq.failed"
    : "geocode_status.is.null,geocode_status.eq.pending,geocode_status.eq.retry,geocode_status.eq.processing";

  return query.or(statuses);
}

async function updateHospital(id, values) {
  const { error } = await supabase.from("hospitals").update(values).eq("id", id);
  if (error) throw error;
}

async function requestGeocode(query) {
  const endpoint = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`;

  for (let attempt = 1; attempt <= MAX_HTTP_RETRIES; attempt += 1) {
    const response = await fetch(endpoint, {
      headers: {
        "x-ncp-apigw-api-key-id": naverClientId,
        "x-ncp-apigw-api-key": naverClientSecret,
      },
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (response.ok) {
      const address = payload.addresses?.[0];
      if (!address) throw new Error("검색 결과 없음");

      const longitude = Number(address.x);
      const latitude = Number(address.y);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("좌표 응답 형식 오류");
      }

      return { latitude, longitude };
    }

    const retryable = response.status === 429 || response.status >= 500;
    const message =
      payload.errorMessage || payload.message || `NAVER API HTTP ${response.status}`;

    if (!retryable || attempt === MAX_HTTP_RETRIES) {
      throw new Error(message);
    }

    const waitMs = Math.min(30_000, 1_500 * 2 ** (attempt - 1));
    console.log(`  API 제한/일시 오류(${response.status}) → ${waitMs / 1000}초 후 재시도`);
    await sleep(waitMs);
  }

  throw new Error("Geocoding 재시도 한도 초과");
}

const { count: eligibleCount, error: countError } = await buildEligibleQuery({
  countOnly: true,
});
if (countError) throw countError;

const planned = Number.isFinite(totalLimit)
  ? Math.min(eligibleCount ?? 0, totalLimit)
  : eligibleCount ?? 0;

console.log("PAWU V7.0.3 자동 좌표 생성 시작");
console.log(`처리 대상: ${planned.toLocaleString()}건`);
console.log(`범위: ${activeOnly ? "영업 병원만" : "전체 병원"}`);
console.log(`실패 재처리: ${retryFailed ? "포함" : "제외"}`);
console.log("Ctrl+C를 한 번 누르면 현재 건 처리 후 안전하게 종료합니다.\n");

let processed = 0;
let succeeded = 0;
let failed = 0;
let batchNumber = 0;

while (!stopRequested && processed < planned) {
  const remaining = planned - processed;
  const limit = Math.min(BATCH_SIZE, remaining);

  const { data: hospitals, error } = await buildEligibleQuery()
    .order("id", { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!hospitals?.length) break;

  batchNumber += 1;
  console.log(`\n[배치 ${batchNumber}] ${hospitals.length}건 처리`);

  for (const hospital of hospitals) {
    if (stopRequested) break;

    const query = buildAddress(hospital);

    try {
      await updateHospital(hospital.id, {
        geocode_status: "processing",
        geocode_error: null,
      });

      if (!query) throw new Error("사용 가능한 주소 없음");

      const coordinates = await requestGeocode(query);
      await updateHospital(hospital.id, {
        ...coordinates,
        geocode_status: "completed",
        geocode_error: null,
      });
      succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await updateHospital(hospital.id, {
        geocode_status: "failed",
        geocode_error: message.slice(0, 500),
      });
      failed += 1;
    }

    processed += 1;
    console.log(
      `${processed.toLocaleString()}/${planned.toLocaleString()} | 성공 ${succeeded.toLocaleString()} | 실패 ${failed.toLocaleString()} | ${hospital.name}`
    );
    await sleep(REQUEST_DELAY_MS);
  }

  if (!stopRequested && processed < planned) {
    console.log(`${BATCH_DELAY_MS / 1000}초 대기 후 다음 배치를 시작합니다.`);
    await sleep(BATCH_DELAY_MS);
  }
}

console.log("\n========================================");
console.log(stopRequested ? "좌표 생성이 안전하게 중단되었습니다." : "좌표 생성 작업이 완료되었습니다.");
console.log(`처리: ${processed.toLocaleString()}건`);
console.log(`성공: ${succeeded.toLocaleString()}건`);
console.log(`실패: ${failed.toLocaleString()}건`);
console.log("========================================");

if (stopRequested) {
  console.log("같은 명령을 다시 실행하면 남은 병원부터 이어서 처리합니다.");
}
