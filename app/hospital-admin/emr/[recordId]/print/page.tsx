"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function text(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || "-";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

function categoryLabel(value: string) {
  switch (value) {
    case "laboratory":
      return "검사실";
    case "xray":
      return "X-ray";
    case "ultrasound":
      return "초음파";
    case "ct":
      return "CT";
    case "mri":
      return "MRI";
    case "endoscopy":
      return "내시경";
    case "pathology":
      return "병리";
    default:
      return "기타";
  }
}

function flagLabel(value: string | null) {
  switch (value) {
    case "normal":
      return "정상";
    case "low":
      return "낮음";
    case "high":
      return "높음";
    case "critical_low":
      return "위험 낮음";
    case "critical_high":
      return "위험 높음";
    case "abnormal":
      return "이상";
    default:
      return "-";
  }
}

const chartSections = [
  ["chief_complaint", "주호소"],
  ["subjective", "S · Subjective"],
  ["objective", "O · Objective"],
  ["assessment", "A · Assessment"],
  ["plan", "P · Plan"],
  ["diagnosis", "진단"],
  ["treatment", "처치"],
  ["follow_up", "추적관리"],
] as const;

export default function EmrPrintPage() {
  const params = useParams<{ recordId: string }>();
  const [record, setRecord] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [recordResponse, diagnosticsResponse] = await Promise.all([
          hospitalAuthFetch(
            `/api/hospital/medical-records/${params.recordId}`,
          ),
          hospitalAuthFetch(
            `/api/hospital/medical-records/${params.recordId}/diagnostics`,
          ),
        ]);

        const recordResult = await recordResponse.json();
        const diagnosticsResult = await diagnosticsResponse.json();

        if (!recordResponse.ok) {
          throw new Error(recordResult.message ?? "진료기록 조회 실패");
        }

        if (!diagnosticsResponse.ok) {
          throw new Error(
            diagnosticsResult.message ?? "검사 결과 조회 실패",
          );
        }

        setRecord(recordResult.record);
        setDiagnostics(diagnosticsResult.diagnostics ?? []);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "인쇄용 진료기록을 불러오지 못했습니다.",
        );
      }
    }

    void load();
  }, [params.recordId]);

  const parsed = useMemo(() => {
    if (!record) return null;

    const patient = one(record.hospital_patients);
    const pet = one(patient?.pets);
    const reservation = one(record.reservations);
    const hospital = one(record.hospitals);

    return {
      patient,
      pet,
      reservation,
      hospital,
    };
  }, [record]);

  if (!record || !parsed) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-3xl border border-slate-300 bg-white p-10 text-center">
          {message || "인쇄용 진료기록을 불러오는 중입니다."}
        </div>
      </main>
    );
  }

  const { patient, pet, reservation, hospital } = parsed;
  const completedDiagnostics = diagnostics.filter(
    (item) => item.status === "completed",
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-black print:bg-white print:p-0">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 14mm;
        }

        @media print {
          html,
          body {
            background: white !important;
          }

          .print-hidden {
            display: none !important;
          }

          .print-sheet {
            box-shadow: none !important;
            border: 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .page-break {
            break-before: page;
            page-break-before: always;
          }
        }
      `}</style>

      <div className="print-hidden mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2">
        <Link
          href={`/hospital-admin/emr/${params.recordId}`}
          className="border border-slate-400 bg-white px-4 py-2 text-sm font-bold"
        >
          ← 전자차트로 돌아가기
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="bg-slate-950 px-5 py-2.5 text-sm font-bold text-white"
        >
          인쇄 또는 PDF 저장
        </button>
      </div>

      <article className="print-sheet mx-auto max-w-[210mm] border border-slate-300 bg-white p-8 shadow-sm">
        <header className="border-b-2 border-slate-950 pb-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-slate-500">
                PAWU MEDICAL RECORD
              </p>
              <h1 className="mt-2 text-2xl font-black">
                동물 진료기록
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                진료기록 번호 #{record.id}
              </p>
            </div>

            <div className="text-right text-sm">
              <p className="font-bold">
                {hospital?.name ?? "동물병원"}
              </p>
              <p className="mt-1 text-slate-500">
                출력일 {new Date().toLocaleDateString("ko-KR")}
              </p>
            </div>
          </div>
        </header>

        <section className="avoid-break mt-6">
          <h2 className="border-b border-slate-300 pb-2 text-sm font-black">
            환자 및 보호자 정보
          </h2>

          <dl className="mt-3 grid grid-cols-2 border-l border-t border-slate-300 text-sm">
            {[
              ["환자명", pet?.name],
              ["환자번호", patient?.patient_number],
              ["동물 종류", pet?.species],
              ["품종", pet?.breed],
              ["성별", pet?.gender],
              ["체중", pet?.weight_kg ? `${pet.weight_kg} kg` : "-"],
              ["보호자", reservation?.guardian_name],
              ["연락처", reservation?.phone],
              ["예약일", reservation?.reservation_date],
              ["예약시간", reservation?.reservation_time],
              ["진료 상태", record.status],
              ["진료 완료일", record.completed_at],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="grid grid-cols-[105px_1fr] border-b border-r border-slate-300"
              >
                <dt className="bg-slate-100 px-3 py-2 font-bold">
                  {label}
                </dt>
                <dd className="px-3 py-2">
                  {label === "진료 완료일"
                    ? formatDateTime(value as string)
                    : text(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-7">
          <h2 className="border-b border-slate-300 pb-2 text-sm font-black">
            SOAP 및 진료 내용
          </h2>

          <div className="mt-3 space-y-3">
            {chartSections.map(([key, label]) => (
              <section
                key={key}
                className="avoid-break border border-slate-300"
              >
                <h3 className="bg-slate-100 px-3 py-2 text-sm font-bold">
                  {label}
                </h3>
                <p className="min-h-12 whitespace-pre-wrap px-3 py-3 text-sm leading-6">
                  {text(record[key])}
                </p>
              </section>
            ))}
          </div>
        </section>

        <section className="avoid-break mt-7">
          <h2 className="border-b border-slate-300 pb-2 text-sm font-black">
            처방
          </h2>

          {(record.medical_prescriptions ?? []).length === 0 ? (
            <p className="mt-3 border border-slate-300 p-4 text-sm text-slate-500">
              등록된 처방이 없습니다.
            </p>
          ) : (
            <table className="mt-3 w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2">약품명</th>
                  <th className="border border-slate-300 p-2">투여량</th>
                  <th className="border border-slate-300 p-2">빈도</th>
                  <th className="border border-slate-300 p-2">기간</th>
                  <th className="border border-slate-300 p-2">경로</th>
                  <th className="border border-slate-300 p-2">안내</th>
                </tr>
              </thead>
              <tbody>
                {(record.medical_prescriptions ?? []).map((item: any) => (
                  <tr key={item.id}>
                    <td className="border border-slate-300 p-2 font-bold">
                      {text(item.medication_name)}
                    </td>
                    <td className="border border-slate-300 p-2">
                      {text(item.dosage)}
                    </td>
                    <td className="border border-slate-300 p-2">
                      {text(item.frequency)}
                    </td>
                    <td className="border border-slate-300 p-2">
                      {text(item.duration)}
                    </td>
                    <td className="border border-slate-300 p-2">
                      {text(item.route)}
                    </td>
                    <td className="border border-slate-300 p-2">
                      {text(item.instructions)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-7">
          <h2 className="border-b border-slate-300 pb-2 text-sm font-black">
            검사·영상 결과
          </h2>

          {completedDiagnostics.length === 0 ? (
            <p className="mt-3 border border-slate-300 p-4 text-sm text-slate-500">
              완료된 검사·영상 결과가 없습니다.
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              {completedDiagnostics.map((diagnostic) => (
                <article
                  key={diagnostic.id}
                  className="avoid-break border border-slate-300"
                >
                  <div className="flex items-start justify-between gap-4 bg-slate-100 px-3 py-3">
                    <div>
                      <p className="text-xs font-bold text-slate-500">
                        {categoryLabel(diagnostic.category)}
                      </p>
                      <h3 className="mt-1 text-sm font-black">
                        {diagnostic.test_name}
                      </h3>
                    </div>
                    <p className="text-xs">
                      {formatDateTime(diagnostic.completed_at)}
                    </p>
                  </div>

                  {diagnostic.interpretation && (
                    <div className="border-t border-slate-300 px-3 py-3">
                      <p className="text-xs font-bold">판독 소견</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                        {diagnostic.interpretation}
                      </p>
                    </div>
                  )}

                  {(diagnostic.diagnostic_result_items ?? []).length >
                    0 && (
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr>
                          <th className="border-t border-r border-slate-300 p-2">
                            항목
                          </th>
                          <th className="border-t border-r border-slate-300 p-2">
                            결과
                          </th>
                          <th className="border-t border-r border-slate-300 p-2">
                            참고 범위
                          </th>
                          <th className="border-t border-slate-300 p-2">
                            판정
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          diagnostic.diagnostic_result_items ?? []
                        ).map((item: any) => (
                          <tr key={item.id}>
                            <td className="border-t border-r border-slate-300 p-2 font-bold">
                              {item.item_name}
                            </td>
                            <td className="border-t border-r border-slate-300 p-2">
                              {item.value_number ??
                                item.value_text ??
                                "-"}
                              {item.unit ? ` ${item.unit}` : ""}
                            </td>
                            <td className="border-t border-r border-slate-300 p-2">
                              {item.reference_text ||
                                `${item.reference_min ?? "-"} ~ ${
                                  item.reference_max ?? "-"
                                }${item.unit ? ` ${item.unit}` : ""}`}
                            </td>
                            <td className="border-t border-slate-300 p-2">
                              {flagLabel(item.abnormal_flag)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="page-break mt-7">
          <h2 className="border-b border-slate-300 pb-2 text-sm font-black">
            보호자 안내
          </h2>

          <div className="mt-3 space-y-3">
            {[
              ["오늘 진료 요약", record.guardian_summary],
              ["보호자 주의사항", record.care_instructions],
              ["공통 투약 안내", record.medication_instructions],
              [
                "다음 방문 권장일",
                record.next_visit_date
                  ? formatDate(record.next_visit_date)
                  : "-",
              ],
            ].map(([label, value]) => (
              <section
                key={String(label)}
                className="avoid-break border border-slate-300"
              >
                <h3 className="bg-slate-100 px-3 py-2 text-sm font-bold">
                  {label}
                </h3>
                <p className="min-h-12 whitespace-pre-wrap px-3 py-3 text-sm leading-6">
                  {text(value)}
                </p>
              </section>
            ))}
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-400 pt-5 text-xs leading-5 text-slate-500">
          <p>
            본 문서는 PAWU 병원 전자차트에 입력된 내용을 기준으로
            생성되었습니다.
          </p>
          <p>
            병원 내부 메모와 AI 참고자료는 보호자용 출력 내용에서
            제외됩니다.
          </p>
        </footer>
      </article>
    </main>
  );
}
