export type SymptomGuideInput = {
  species?: string;
  symptomText: string;
};

const emergencySignals = [
  "호흡곤란", "숨을 못", "의식 없음", "의식이 없", "경련", "발작",
  "대량 출혈", "피가 멈추지", "교통사고", "추락", "독극물",
  "초콜릿", "포도", "건포도", "자일리톨", "양파", "백합",
  "소변을 못", "배가 부풀", "잇몸이 하얗", "청색", "체온이 너무",
];

const urgentSignals = [
  "계속 토", "반복 구토", "혈변", "피오줌", "혈뇨", "하루 종일 안 먹",
  "물을 못 마", "심한 통증", "절뚝", "눈을 못 뜨", "심하게 처짐",
];

export function createSymptomGuide(input: SymptomGuideInput) {
  const text = input.symptomText.trim();
  const emergency = emergencySignals.some((signal) => text.includes(signal));
  const urgent = urgentSignals.some((signal) => text.includes(signal));

  const level = emergency ? "emergency" : urgent ? "urgent" : "observe";

  const title =
    level === "emergency"
      ? "즉시 가까운 동물병원에 연락하세요"
      : level === "urgent"
        ? "가능하면 오늘 안에 병원 상담을 권장합니다"
        : "상태를 관찰하며 병원 상담을 준비해 주세요";

  const actions =
    level === "emergency"
      ? [
          "직접 운전이 어렵다면 주변 사람에게 도움을 요청하세요.",
          "먹인 음식·약·물질이 있다면 포장이나 사진을 가져가세요.",
          "억지로 토하게 하거나 사람 약을 먹이지 마세요.",
        ]
      : level === "urgent"
        ? [
            "증상이 시작된 시간과 횟수를 기록하세요.",
            "구토·변·소변·호흡 상태를 사진이나 영상으로 남기세요.",
            "사람 약이나 이전 처방약을 임의로 사용하지 마세요.",
          ]
        : [
            "식욕, 물 섭취, 배변·배뇨, 활동량을 기록하세요.",
            "증상이 악화되거나 반복되면 병원에 상담하세요.",
            "새 음식, 간식, 약, 환경 변화가 있었는지 확인하세요.",
          ];

  return {
    level,
    title,
    actions,
    disclaimer:
      "PAWU 안내는 증상을 정리하고 병원 상담 시점을 돕기 위한 정보이며 진단이나 처방이 아닙니다.",
  };
}

export function buildMedicalSummary(record: {
  diagnosis?: string | null;
  exam_results?: string | null;
  care_instructions?: string | null;
  medication_instructions?: string | null;
  next_visit_date?: string | null;
}) {
  return [
    record.diagnosis ? `핵심 진료 소견: ${record.diagnosis}` : null,
    record.exam_results ? `검사 내용: ${record.exam_results}` : null,
    record.medication_instructions
      ? `복약 핵심: ${record.medication_instructions}`
      : null,
    record.care_instructions
      ? `가정 관리: ${record.care_instructions}`
      : null,
    record.next_visit_date
      ? `다음 확인 예정일: ${record.next_visit_date}`
      : null,
    "이 요약은 병원이 입력한 내용을 정리한 것이며 새로운 진단을 생성하지 않습니다.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
