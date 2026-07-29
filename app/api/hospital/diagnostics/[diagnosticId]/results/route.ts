import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  isHospitalDiagnosticAuthError,
  requireHospitalDiagnosticContext,
} from "@/lib/hospital-diagnostic-auth";

type ResultItemInput = {
  itemCode?: string | null;
  itemName?: string;
  valueText?: string | null;
  valueNumber?: number | string | null;
  unit?: string | null;
  referenceMin?: number | string | null;
  referenceMax?: number | string | null;
  referenceText?: string | null;
  abnormalFlag?: string | null;
  sortOrder?: number;
  note?: string | null;
};

type Body = {
  items?: ResultItemInput[];
  interpretation?: string | null;
  guardianSummary?: string | null;
  isGuardianVisible?: boolean;
  markCompleted?: boolean;
};

const abnormalFlags = new Set([
  "normal",
  "low",
  "high",
  "critical_low",
  "critical_high",
  "abnormal",
]);

function numericOrNull(
  value: number | string | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ diagnosticId: string }>;
  },
) {
  const context = await requireHospitalDiagnosticContext(request);

  if (isHospitalDiagnosticAuthError(context)) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { diagnosticId: diagnosticIdParam } = await params;
  const diagnosticId = Number(diagnosticIdParam);
  const body = (await request.json()) as Body;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!Number.isInteger(diagnosticId)) {
    return NextResponse.json(
      { message: "검사 번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("diagnostic_orders")
    .select("*")
    .eq("id", diagnosticId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json(
      { message: orderError.message },
      { status: 500 },
    );
  }

  if (!order) {
    return NextResponse.json(
      { message: "검사 기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const payload = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const itemName = String(item.itemName ?? "").trim();

    if (!itemName) {
      return NextResponse.json(
        { message: `${index + 1}번째 결과 항목명이 비어 있습니다.` },
        { status: 400 },
      );
    }

    const abnormalFlag =
      String(item.abnormalFlag ?? "").trim() || null;

    if (
      abnormalFlag &&
      !abnormalFlags.has(abnormalFlag)
    ) {
      return NextResponse.json(
        { message: `${itemName}의 이상 수치 구분이 올바르지 않습니다.` },
        { status: 400 },
      );
    }

    payload.push({
      diagnostic_order_id: diagnosticId,
      item_code: String(item.itemCode ?? "").trim() || null,
      item_name: itemName,
      value_text: String(item.valueText ?? "").trim() || null,
      value_number: numericOrNull(item.valueNumber),
      unit: String(item.unit ?? "").trim() || null,
      reference_min: numericOrNull(item.referenceMin),
      reference_max: numericOrNull(item.referenceMax),
      reference_text:
        String(item.referenceText ?? "").trim() || null,
      abnormal_flag: abnormalFlag,
      sort_order:
        Number.isInteger(item.sortOrder)
          ? Number(item.sortOrder)
          : index,
      note: String(item.note ?? "").trim() || null,
    });
  }

  const { data: beforeItems } = await supabaseAdmin
    .from("diagnostic_result_items")
    .select("*")
    .eq("diagnostic_order_id", diagnosticId);

  const { error: deleteError } = await supabaseAdmin
    .from("diagnostic_result_items")
    .delete()
    .eq("diagnostic_order_id", diagnosticId);

  if (deleteError) {
    return NextResponse.json(
      { message: deleteError.message },
      { status: 500 },
    );
  }

  let insertedItems: unknown[] = [];

  if (payload.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("diagnostic_result_items")
      .insert(payload)
      .select("*");

    if (error) {
      return NextResponse.json(
        { message: error.message },
        { status: 500 },
      );
    }

    insertedItems = data ?? [];
  }

  const orderUpdate: Record<string, unknown> = {};

  if (body.interpretation !== undefined) {
    orderUpdate.interpretation =
      String(body.interpretation ?? "").trim() || null;
  }

  if (body.guardianSummary !== undefined) {
    orderUpdate.guardian_summary =
      String(body.guardianSummary ?? "").trim() || null;
  }

  if (body.isGuardianVisible !== undefined) {
    orderUpdate.is_guardian_visible = body.isGuardianVisible;
  }

  if (body.markCompleted) {
    orderUpdate.status = "completed";
    orderUpdate.completed_at = new Date().toISOString();
  }

  let updatedOrder = order;

  if (Object.keys(orderUpdate).length > 0) {
    const { data, error } = await supabaseAdmin
      .from("diagnostic_orders")
      .update(orderUpdate)
      .eq("id", diagnosticId)
      .eq("hospital_id", context.hospitalId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { message: error.message },
        { status: 500 },
      );
    }

    updatedOrder = data;
  }

  await supabaseAdmin.from("diagnostic_audit_logs").insert({
    hospital_id: context.hospitalId,
    diagnostic_order_id: diagnosticId,
    actor_user_id: context.userId,
    action: "diagnostic_results_replaced",
    before_data: {
      order,
      items: beforeItems ?? [],
    },
    after_data: {
      order: updatedOrder,
      items: insertedItems,
    },
  });

  return NextResponse.json({
    success: true,
    diagnostic: updatedOrder,
    items: insertedItems,
  });
}
