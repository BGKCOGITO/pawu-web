export const ROUTE_OPTIONS = [
  "경구",
  "피하",
  "근육",
  "정맥",
  "점안",
  "점이",
  "외용",
  "흡입",
  "기타",
] as const;

export const FREQUENCY_OPTIONS = [
  "하루 1회",
  "하루 2회",
  "하루 3회",
  "하루 4회",
  "격일",
  "필요 시",
  "기타",
] as const;

export const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  draft: "작성 중",
  finalized: "처방 확정",
  cancelled: "취소",
};
