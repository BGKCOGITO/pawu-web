import fs from "node:fs";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const csvFile =
  process.argv.find((arg) => arg.toLowerCase().endsWith(".csv")) ??
  "data/hospitals-public-10588.csv";

const dryRun = process.argv.includes("--dry-run");
const BATCH_SIZE = 200;

/**
 * CSV 파서
 * - 쉼표
 * - 줄바꿈
 * - 큰따옴표
 * - 큰따옴표 이스케이프("")
 * 를 처리한다.
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];

    if (current === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (current === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((current === "\n" || current === "\r") && !quoted) {
      if (current === "\r" && next === "\n") {
        index += 1;
      }

      row.push(cell);

      if (row.some((value) => value !== "")) {
        rows.push(row);
      }

      row = [];
      cell = "";
      continue;
    }

    cell += current;
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);

    if (row.some((value) => value !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function clean(value) {
  return String(value ?? "").trim();
}

function nullableText(value) {
  const normalized = clean(value);
  return normalized === "" ? null : normalized;
}

function normalizePhone(value) {
  const normalized = clean(value)
    .replace(/\.0$/, "")
    .replace(/[^0-9]/g, "");

  return normalized === "" ? null : normalized;
}

function normalizeDate(value) {
  const normalized = clean(value);

  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})/);

  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * 공공데이터 갱신 시각은 화면 표시 및 참고용이다.
 * DB에서 타임존 표기 방식이 달라져 전체 행이 변경으로 인식되는 문제를 막기 위해
 * 변경 비교 대상에서는 제외한다.
 */
function normalizeTimestamp(value) {
  const normalized = clean(value);

  if (!normalized) {
    return null;
  }

  const prepared = normalized.replace(" ", "T");
  const parsed = new Date(prepared);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const dateOnly = normalizeDate(normalized);
  return dateOnly ? `${dateOnly}T00:00:00.000Z` : null;
}

function extractRegion(address) {
  const parts = clean(address).split(/\s+/).filter(Boolean);

  return {
    regionLevel1: parts[0] ?? null,
    regionLevel2: parts[1] ?? null,
  };
}

function calculateIsActive(businessStatus, detailedBusinessStatus) {
  return (
    businessStatus === "영업/정상" &&
    (!detailedBusinessStatus || detailedBusinessStatus === "정상")
  );
}

function comparableText(value) {
  const normalized = clean(value);
  return normalized === "" ? null : normalized;
}

function comparableBoolean(value) {
  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  return null;
}

function comparableValue(value, type) {
  switch (type) {
    case "phone":
      return normalizePhone(value);
    case "date":
      return normalizeDate(value);
    case "boolean":
      return comparableBoolean(value);
    default:
      return comparableText(value);
  }
}

/**
 * 실제 공공데이터 변경으로 판단할 핵심 필드만 비교한다.
 *
 * 아래 필드는 비교에서 제외한다.
 * - imported_at
 * - import_log_id
 * - last_seen_at
 * - public_data_raw
 * - public_data_updated_at
 * - normalized_name
 * - region_level1 / region_level2
 * - latitude / longitude
 * - geocode 관련 필드
 *
 * 이유:
 * 위 값들은 Import 실행 시각, 파생값, 원문 JSON, 좌표 작업 결과이므로
 * 같은 CSV를 다시 넣을 때 병원 정보 변경으로 판단하면 안 된다.
 */
const COMPARE_FIELDS = [
  ["name", "text"],
  ["address", "text"],
  ["road_address", "text"],
  ["lot_address", "text"],
  ["phone", "phone"],
  ["business_status", "text"],
  ["detailed_business_status", "text"],
  ["is_active", "boolean"],
  ["license_date", "date"],
  ["closed_at", "date"],
];

function findChangedFields(existingHospital, nextHospital) {
  return COMPARE_FIELDS.filter(([field, type]) => {
    const previousValue = comparableValue(existingHospital[field], type);
    const nextValue = comparableValue(nextHospital[field], type);

    return previousValue !== nextValue;
  }).map(([field]) => field);
}

function getChangedPayload(nextHospital, changedFields) {
  const payload = {};

  for (const field of changedFields) {
    payload[field] = nextHospital[field];
  }

  /*
   * 파생 데이터는 핵심 데이터가 바뀐 경우 함께 최신값으로 맞춘다.
   */
  payload.source_type = "public_data";
  payload.normalized_name = nextHospital.normalized_name;
  payload.region_level1 = nextHospital.region_level1;
  payload.region_level2 = nextHospital.region_level2;
  payload.public_data_updated_at = nextHospital.public_data_updated_at;
  payload.public_data_raw = nextHospital.public_data_raw;
  payload.is_published = true;

  return payload;
}

if (!fs.existsSync(csvFile)) {
  throw new Error(`CSV 파일을 찾을 수 없습니다: ${csvFile}`);
}

const csvBuffer = fs.readFileSync(csvFile);

/*
 * 공공데이터 원본이 EUC-KR인 경우를 우선 처리한다.
 */
let csvText;

try {
  csvText = new TextDecoder("euc-kr").decode(csvBuffer);
} catch {
  csvText = csvBuffer.toString("utf8");
}

const matrix = parseCSV(csvText.replace(/^\uFEFF/, ""));

if (matrix.length === 0) {
  throw new Error("CSV에 데이터가 없습니다.");
}

const headers = matrix.shift().map((header) => clean(header));
const seenExternalIds = new Set();
const records = [];

let duplicateCount = 0;
let invalidCount = 0;

for (const cells of matrix) {
  const raw = Object.fromEntries(
    headers.map((header, index) => [header, cells[index] ?? ""]),
  );

  const externalId = clean(raw["관리번호"]);
  const name = clean(raw["사업장명"]);

  if (!externalId || !name) {
    invalidCount += 1;
    continue;
  }

  if (seenExternalIds.has(externalId)) {
    duplicateCount += 1;
    continue;
  }

  seenExternalIds.add(externalId);

  const roadAddress = nullableText(raw["도로명주소"]);
  const lotAddress = nullableText(raw["지번주소"]);
  const address = roadAddress ?? lotAddress;

  /*
   * 현재 hospitals.address가 NOT NULL이므로 주소가 전혀 없는 행은 제외한다.
   */
  if (!address) {
    invalidCount += 1;
    continue;
  }

  const { regionLevel1, regionLevel2 } = extractRegion(address);
  const businessStatus = nullableText(raw["영업상태명"]);
  const detailedBusinessStatus = nullableText(raw["상세영업상태명"]);

  records.push({
    external_id: externalId,
    name,
    address,
    road_address: roadAddress,
    lot_address: lotAddress,
    phone: normalizePhone(raw["전화번호"]),
    source_type: "public_data",
    business_status: businessStatus,
    detailed_business_status: detailedBusinessStatus,
    is_active: calculateIsActive(
      businessStatus,
      detailedBusinessStatus,
    ),
    license_date: normalizeDate(raw["인허가일자"]),
    closed_at: normalizeDate(
      raw["폐업일자"] || raw["인허가취소일자"],
    ),
    public_data_updated_at: normalizeTimestamp(
      raw["데이터갱신시점"] || raw["최종수정시점"],
    ),
    public_data_raw: raw,
    normalized_name: name.replace(/\s+/g, "").toLowerCase(),
    region_level1: regionLevel1,
    region_level2: regionLevel2,
    is_published: true,
  });
}

console.log(
  `원본 ${matrix.length} / 유효 ${records.length} / 중복 ${duplicateCount} / 제외 ${invalidCount}`,
);

if (dryRun) {
  console.log("사전검증 완료: DB는 변경되지 않았습니다.");
  process.exit(0);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다.",
  );
}

const { createClient } = await import("@supabase/supabase-js");

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const fileHash = crypto
  .createHash("sha256")
  .update(csvBuffer)
  .digest("hex");

const startedAt = new Date().toISOString();

const { data: importLog, error: importLogError } = await supabase
  .from("hospital_import_logs")
  .insert({
    file_name: csvFile.split(/[\\/]/).pop(),
    file_sha256: fileHash,
    import_type: "csv",
    total_rows: matrix.length,
    valid_rows: records.length,
    invalid_rows: invalidCount,
    duplicate_count: duplicateCount,
    status: "processing",
    started_at: startedAt,
  })
  .select("id")
  .single();

if (importLogError) {
  throw importLogError;
}

let insertedCount = 0;
let updatedCount = 0;
let unchangedCount = 0;
let failedCount = 0;

try {
  for (
    let offset = 0;
    offset < records.length;
    offset += BATCH_SIZE
  ) {
    const batch = records.slice(offset, offset + BATCH_SIZE);
    const externalIds = batch.map((record) => record.external_id);

    const { data: existingRows, error: existingRowsError } =
      await supabase
        .from("hospitals")
        .select(
          [
            "id",
            "external_id",
            "name",
            "address",
            "road_address",
            "lot_address",
            "phone",
            "business_status",
            "detailed_business_status",
            "is_active",
            "license_date",
            "closed_at",
            "latitude",
            "longitude",
          ].join(","),
        )
        .in("external_id", externalIds);

    if (existingRowsError) {
      throw existingRowsError;
    }

    const existingHospitalMap = new Map(
      (existingRows ?? []).map((hospital) => [
        hospital.external_id,
        hospital,
      ]),
    );

    for (const nextHospital of batch) {
      const existingHospital = existingHospitalMap.get(
        nextHospital.external_id,
      );

      const processedAt = new Date().toISOString();

      if (!existingHospital) {
        const insertPayload = {
          ...nextHospital,
          imported_at: processedAt,
          import_log_id: importLog.id,
          last_seen_at: processedAt,
          reservation_enabled: false,
          geocode_status: "pending",
          geocode_error: null,
        };

        const { data: insertedHospital, error: insertError } =
          await supabase
            .from("hospitals")
            .insert(insertPayload)
            .select("id")
            .single();

        if (insertError) {
          failedCount += 1;

          await supabase
            .from("hospital_import_changes")
            .insert({
              import_log_id: importLog.id,
              external_id: nextHospital.external_id,
              change_type: "failed",
              error_message: insertError.message,
              new_data: nextHospital,
            });

          continue;
        }

        insertedCount += 1;

        await supabase
          .from("hospital_import_changes")
          .insert({
            import_log_id: importLog.id,
            hospital_id: insertedHospital.id,
            external_id: nextHospital.external_id,
            change_type: "inserted",
            changed_fields: COMPARE_FIELDS.map(
              ([field]) => field,
            ),
            new_data: nextHospital,
          });

        continue;
      }

      const changedFields = findChangedFields(
        existingHospital,
        nextHospital,
      );

      if (changedFields.length === 0) {
        unchangedCount += 1;
        continue;
      }

      const updatePayload = {
        ...getChangedPayload(nextHospital, changedFields),
        imported_at: processedAt,
        import_log_id: importLog.id,
        last_seen_at: processedAt,
      };

      /*
       * 주소가 실제로 바뀐 병원만 기존 좌표를 초기화한다.
       */
      if (
        changedFields.includes("address") ||
        changedFields.includes("road_address") ||
        changedFields.includes("lot_address")
      ) {
        updatePayload.latitude = null;
        updatePayload.longitude = null;
        updatePayload.geocode_status = "pending";
        updatePayload.geocode_error = null;
      }

      const { error: updateError } = await supabase
        .from("hospitals")
        .update(updatePayload)
        .eq("id", existingHospital.id);

      if (updateError) {
        failedCount += 1;

        await supabase
          .from("hospital_import_changes")
          .insert({
            import_log_id: importLog.id,
            hospital_id: existingHospital.id,
            external_id: nextHospital.external_id,
            change_type: "failed",
            changed_fields: changedFields,
            old_data: existingHospital,
            new_data: nextHospital,
            error_message: updateError.message,
          });

        continue;
      }

      updatedCount += 1;

      await supabase
        .from("hospital_import_changes")
        .insert({
          import_log_id: importLog.id,
          hospital_id: existingHospital.id,
          external_id: nextHospital.external_id,
          change_type: "updated",
          changed_fields: changedFields,
          old_data: existingHospital,
          new_data: nextHospital,
        });
    }

    const completed = Math.min(
      offset + BATCH_SIZE,
      records.length,
    );

    console.log(`${completed}/${records.length}`);
  }

  const completedAt = new Date().toISOString();

  await supabase
    .from("hospital_import_logs")
    .update({
      inserted_count: insertedCount,
      updated_count: updatedCount,
      unchanged_count: unchangedCount,
      failed_count: failedCount,
      status: failedCount > 0 ? "failed" : "completed",
      completed_at: completedAt,
      error_message:
        failedCount > 0
          ? `${failedCount}건 처리 실패. hospital_import_changes를 확인하세요.`
          : null,
    })
    .eq("id", importLog.id);

  console.log({
    inserted: insertedCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    failed: failedCount,
    logId: importLog.id,
  });
} catch (error) {
  await supabase
    .from("hospital_import_logs")
    .update({
      status: "failed",
      error_message:
        error instanceof Error
          ? error.message
          : String(error),
      completed_at: new Date().toISOString(),
    })
    .eq("id", importLog.id);

  throw error;
}
