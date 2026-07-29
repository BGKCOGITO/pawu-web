export type HospitalFeatureDefinition = {
  key: string;
  label: string;
  description: string;
  group: "work" | "clinical" | "operation";
  defaultEnabled: boolean;
  href: string;
};

export type HospitalWidgetDefinition = {
  key: string;
  label: string;
  description: string;
  defaultVisible: boolean;
  defaultOrder: number;
  size: "small" | "medium" | "large";
};

export const HOSPITAL_FEATURES: HospitalFeatureDefinition[] = [
  { key: "dashboard", label: "대시보드", description: "병원의 주요 업무와 상태를 한 화면에서 확인합니다.", group: "work", defaultEnabled: true, href: "/hospital-admin/dashboard" },
  { key: "daily_workflow", label: "오늘의 업무", description: "예약, 접수, 진료, 청구, 재고 검토 흐름을 관리합니다.", group: "work", defaultEnabled: true, href: "/hospital-admin/workflow-v6-2" },
  { key: "reservations", label: "예약 관리", description: "보호자의 예약 요청과 병원 일정을 관리합니다.", group: "work", defaultEnabled: true, href: "/admin/reservations" },
  { key: "patients", label: "환자 관리", description: "환자 기본정보와 누적 진료기록을 확인합니다.", group: "clinical", defaultEnabled: true, href: "/hospital-admin/patients" },
  { key: "emr", label: "전자차트", description: "SOAP, 진단, 처치, 처방과 보호자 설명을 작성합니다.", group: "clinical", defaultEnabled: true, href: "/hospital-admin/emr" },
  { key: "prescriptions", label: "처방·복약", description: "처방 항목, 복약 안내와 보호자 공개를 관리합니다.", group: "clinical", defaultEnabled: true, href: "/hospital-admin/prescriptions" },
  { key: "lab_imaging", label: "검사·영상", description: "혈액검사, 영상, PDF와 결과 판독을 관리합니다.", group: "clinical", defaultEnabled: true, href: "/hospital-admin/lab" },
  { key: "billing", label: "청구·결제", description: "진료항목과 청구서, 결제 요청을 관리합니다.", group: "operation", defaultEnabled: true, href: "/hospital-admin/billing/new" },
  { key: "service_catalog", label: "진료 항목", description: "병원별 진료항목과 기본 금액을 관리합니다.", group: "operation", defaultEnabled: true, href: "/hospital-admin/billing/catalog" },
  { key: "inventory", label: "재고 관리", description: "의약품, 소모품, 검사키트와 유효기간을 관리합니다.", group: "operation", defaultEnabled: true, href: "/hospital-admin/inventory" },
  { key: "inventory_review", label: "재고 검토", description: "진료 및 청구에 따른 실제 재고 사용량을 확정합니다.", group: "operation", defaultEnabled: true, href: "/hospital-admin/inventory/usage-review" },
  { key: "staff", label: "직원 관리", description: "병원 직원과 업무 권한을 관리합니다.", group: "operation", defaultEnabled: true, href: "/hospital-admin/staff" },
  { key: "analytics", label: "운영 통계", description: "예약, 매출, 검사와 재고 지표를 확인합니다.", group: "operation", defaultEnabled: true, href: "/hospital-admin/analytics" },
];

export const HOSPITAL_WIDGETS: HospitalWidgetDefinition[] = [
  { key: "today_reservations", label: "오늘 예약", description: "오늘 예정된 전체 예약 건수", defaultVisible: true, defaultOrder: 10, size: "small" },
  { key: "today_completed", label: "오늘 완료", description: "오늘 완료 처리된 진료 건수", defaultVisible: true, defaultOrder: 20, size: "small" },
  { key: "requested_reservations", label: "승인 대기", description: "병원의 승인이 필요한 예약 요청", defaultVisible: true, defaultOrder: 30, size: "small" },
  { key: "payment_pending", label: "결제 대기", description: "보호자 결제를 기다리는 청구서", defaultVisible: true, defaultOrder: 40, size: "small" },
  { key: "emr_drafts", label: "작성 중 차트", description: "아직 확정하지 않은 전자차트", defaultVisible: true, defaultOrder: 50, size: "small" },
  { key: "lab_pending", label: "검사 진행", description: "확정 전 검사·영상 주문", defaultVisible: true, defaultOrder: 60, size: "small" },
  { key: "low_stock_count", label: "부족 재고", description: "안전재고 이하인 품목 수", defaultVisible: true, defaultOrder: 70, size: "small" },
  { key: "month_revenue", label: "이번 달 청구", description: "이번 달 결제 대기 및 결제 완료 청구액", defaultVisible: true, defaultOrder: 80, size: "small" },
  { key: "today_schedule_table", label: "오늘 예약 현황표", description: "오늘 예약을 시간순 표로 표시합니다.", defaultVisible: true, defaultOrder: 100, size: "large" },
  { key: "quick_actions", label: "빠른 업무", description: "전자차트, 검사, 청구 등 자주 쓰는 화면 바로가기", defaultVisible: true, defaultOrder: 110, size: "medium" },
  { key: "low_stock_table", label: "부족 재고 목록", description: "안전재고 이하 품목을 목록으로 표시합니다.", defaultVisible: true, defaultOrder: 120, size: "medium" },
  { key: "expiring_inventory", label: "유효기간 임박", description: "60일 이내 만료 예정 로트를 표시합니다.", defaultVisible: true, defaultOrder: 130, size: "medium" },
];

export const FEATURE_GROUP_LABELS = {
  work: "업무",
  clinical: "진료",
  operation: "운영",
} as const;
