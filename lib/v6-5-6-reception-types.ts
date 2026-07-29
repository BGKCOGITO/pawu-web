export type WaitingPriority = "emergency" | "urgent" | "normal";
export type WaitingStatus =
  | "waiting"
  | "called"
  | "in_consultation"
  | "exam"
  | "billing"
  | "completed"
  | "cancelled"
  | "no_show";

export const waitingStatusLabel: Record<WaitingStatus, string> = {
  waiting: "대기",
  called: "호출",
  in_consultation: "진료 중",
  exam: "검사",
  billing: "수납 대기",
  completed: "완료",
  cancelled: "취소",
  no_show: "미내원",
};

export const waitingPriorityLabel: Record<WaitingPriority, string> = {
  emergency: "응급",
  urgent: "우선",
  normal: "일반",
};
