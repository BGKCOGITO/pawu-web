export type VisitPreparationEvent = {
  id: number;
  occurred_at: string;
  event_type: string;
  title: string;
  severity: string | null;
  priority: "emergency" | "high" | "normal" | "reference";
  count_value: number | null;
  note: string | null;
  share_with_hospital: boolean;
};

const eventLabels: Record<string, string> = {
  vomiting: "구토",
  diarrhea: "설사",
  appetite_loss: "식욕 감소",
  water_change: "음수량 변화",
  cough: "기침",
  sneeze: "재채기",
  eye: "눈 이상",
  ear: "귀 이상",
  skin: "피부 이상",
  limping: "절뚝거림",
  seizure: "발작",
  food_change: "사료 변경",
  medication_change: "약 변경",
  weight: "체중 기록",
  hospital_visit: "병원 방문",
  accident: "사고",
  other: "기타",
};

const severityLabels: Record<string, string> = {
  mild: "가벼움",
  moderate: "보통",
  severe: "심함",
};

const priorityWeight: Record<VisitPreparationEvent["priority"], number> = {
  emergency: 4,
  high: 3,
  normal: 2,
  reference: 1,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function eventLabel(event: VisitPreparationEvent) {
  return eventLabels[event.event_type] ?? event.title ?? "기타";
}

export function generateVisitPreparationSummary({
  petName,
  mainConcern,
  events,
}: {
  petName: string;
  mainConcern: string;
  events: VisitPreparationEvent[];
}) {
  const chronological = [...events].sort(
    (a, b) =>
      new Date(a.occurred_at).getTime() -
      new Date(b.occurred_at).getTime(),
  );

  const prioritized = [...events].sort((a, b) => {
    const priorityDifference =
      priorityWeight[b.priority] - priorityWeight[a.priority];

    if (priorityDifference !== 0) return priorityDifference;

    return (
      new Date(b.occurred_at).getTime() -
      new Date(a.occurred_at).getTime()
    );
  });

  const counts = new Map<string, number>();

  for (const event of events) {
    const label = eventLabel(event);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const repeated = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  const emergencyEvents = prioritized.filter(
    (event) => event.priority === "emergency",
  );

  const summaryLines = [
    `${petName}의 진료 준비 기록 ${events.length}건을 정리했습니다.`,
    mainConcern
      ? `보호자가 가장 걱정하는 내용은 “${mainConcern}”입니다.`
      : "보호자가 입력한 주된 걱정 내용은 없습니다.",
    emergencyEvents.length > 0
      ? `응급 중요도로 표시된 기록이 ${emergencyEvents.length}건 포함되어 있습니다.`
      : "응급 중요도로 표시된 기록은 없습니다.",
    repeated.length > 0
      ? `반복 기록: ${repeated
          .map(([label, count]) => `${label} ${count}회`)
          .join(", ")}.`
      : "같은 종류가 반복 기록된 이벤트는 없습니다.",
  ];

  const timelineLines = chronological.map((event) => {
    const details = [
      event.count_value ? `${event.count_value}회` : "",
      event.severity ? severityLabels[event.severity] ?? event.severity : "",
      event.note ?? "",
    ].filter(Boolean);

    return `${formatDate(event.occurred_at)} · ${eventLabel(event)}${
      details.length ? ` · ${details.join(" · ")}` : ""
    }`;
  });

  const keyPoints = prioritized.slice(0, 5).map((event) => {
    const priorityLabel =
      event.priority === "emergency"
        ? "응급"
        : event.priority === "high"
          ? "높음"
          : event.priority === "normal"
            ? "보통"
            : "참고";

    return `[${priorityLabel}] ${formatDate(event.occurred_at)} ${eventLabel(
      event,
    )}${event.note ? `: ${event.note}` : ""}`;
  });

  return {
    summary: summaryLines.join("\n"),
    timeline: timelineLines.join("\n"),
    keyPoints: keyPoints.join("\n"),
  };
}
