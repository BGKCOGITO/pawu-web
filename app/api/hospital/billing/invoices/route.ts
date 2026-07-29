import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import { can, getHospitalAccess, readBearer } from "../../../../../lib/hospital-access";

type InputItem = { serviceItemId?: number | null; name?: string; unitPrice?: number; quantity?: number; discountAmount?: number; additionalAmount?: number; note?: string };

export async function POST(request: Request) {
  const access = await getHospitalAccess(readBearer(request));
  if (!access || !can(access, "create_invoices")) return NextResponse.json({ ok: false, message: "청구서 작성 권한이 없습니다." }, { status: 403 });
  const body = await request.json() as { reservationId?: number | null; petId?: number; guardianUserId?: string | null; items?: InputItem[]; invoiceDiscount?: number; memo?: string };
  const petId = Number(body.petId); const source = Array.isArray(body.items) ? body.items : [];
  if (!Number.isInteger(petId) || source.length === 0) return NextResponse.json({ ok: false, message: "환자와 청구 항목을 선택해 주세요." }, { status: 400 });
  const items = source.map((item, index) => { const unitPrice=Math.max(0,Math.round(Number(item.unitPrice)||0)); const quantity=Math.max(1,Math.round(Number(item.quantity)||1)); const discount=Math.max(0,Math.round(Number(item.discountAmount)||0)); const additional=Math.max(0,Math.round(Number(item.additionalAmount)||0)); return { service_item_id:item.serviceItemId ?? null, item_name:String(item.name??"").trim(), unit_price:unitPrice, quantity, discount_amount:discount, additional_amount:additional, line_amount:Math.max(0,unitPrice*quantity-discount+additional), note:String(item.note??"").trim()||null, sort_order:index }; });
  if (items.some((item) => !item.item_name)) return NextResponse.json({ ok: false, message: "청구 항목명을 확인해 주세요." }, { status: 400 });
  const subtotal=items.reduce((sum,item)=>sum+item.line_amount,0); const invoiceDiscount=Math.max(0,Math.round(Number(body.invoiceDiscount)||0)); const total=Math.max(0,subtotal-invoiceDiscount);
  const { data: invoice, error } = await supabaseAdmin.from("hospital_invoices").insert({ hospital_id:access.hospitalId, reservation_id:body.reservationId??null, pet_id:petId, guardian_user_id:body.guardianUserId??null, subtotal_amount:subtotal, discount_amount:invoiceDiscount, total_amount:total, memo:String(body.memo??"").trim()||null, created_by:access.userId }).select("id").single();
  if (error || !invoice) return NextResponse.json({ ok:false, message:error?.message??"청구서 생성 실패" }, { status:400 });
  const { error:itemError }=await supabaseAdmin.from("hospital_invoice_items").insert(items.map(item=>({ ...item, invoice_id:invoice.id })));
  if (itemError) { await supabaseAdmin.from("hospital_invoices").delete().eq("id",invoice.id); return NextResponse.json({ok:false,message:itemError.message},{status:400}); }
  return NextResponse.json({ ok:true, invoiceId:invoice.id, totalAmount:total });
}

export async function PATCH(request: Request) {
  const access=await getHospitalAccess(readBearer(request));
  if (!access || !can(access,"manage_payments")) return NextResponse.json({ok:false,message:"결제 요청 권한이 없습니다."},{status:403});
  const body=await request.json() as { invoiceId?:number; action?:"request_payment"|"cancel" };
  const id=Number(body.invoiceId); if(!Number.isInteger(id)||!body.action) return NextResponse.json({ok:false,message:"요청 값이 올바르지 않습니다."},{status:400});
  const status=body.action==="request_payment"?"payment_pending":"cancelled";
  const { data,error }=await supabaseAdmin.from("hospital_invoices").update({status,payment_requested_at:body.action==="request_payment"?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",id).eq("hospital_id",access.hospitalId).select("guardian_user_id,total_amount").single();
  if(error) return NextResponse.json({ok:false,message:error.message},{status:400});
  if(body.action==="request_payment"&&data.guardian_user_id) await supabaseAdmin.from("notifications").insert({user_id:data.guardian_user_id,type:"payment_request",title:"병원 결제 요청",body:`결제 예정 금액은 ${Number(data.total_amount).toLocaleString("ko-KR")}원입니다.`,link_url:`/payments/${id}`,metadata:{invoice_id:id}});
  return NextResponse.json({ok:true});
}
