import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import { can, getHospitalAccess, readBearer } from "../../../../../lib/hospital-access";
type Line={serviceItemId?:number|null;name?:string;unitPrice?:number;quantity?:number;discountAmount?:number;additionalAmount?:number;note?:string};
type Payment={method?:string;amount?:number;approvalNumber?:string;memo?:string};
export async function POST(request:Request){
 const access=await getHospitalAccess(readBearer(request)); if(!access||!can(access,"manage_payments")) return NextResponse.json({ok:false,message:"수납 처리 권한이 없습니다."},{status:403});
 const body=await request.json() as {waitingEntryId?:number;reservationId?:number|null;petId?:number;items?:Line[];invoiceDiscount?:number;payments?:Payment[];memo?:string};
 const petId=Number(body.petId), source=Array.isArray(body.items)?body.items:[]; if(!Number.isInteger(petId)||source.length===0) return NextResponse.json({ok:false,message:"환자와 수납 항목을 확인해 주세요."},{status:400});
 const items=source.map((x,i)=>{const unit=Math.max(0,Math.round(Number(x.unitPrice)||0)),qty=Math.max(1,Math.round(Number(x.quantity)||1)),discount=Math.max(0,Math.round(Number(x.discountAmount)||0)),additional=Math.max(0,Math.round(Number(x.additionalAmount)||0));return{service_item_id:x.serviceItemId??null,item_name:String(x.name??"").trim(),unit_price:unit,quantity:qty,discount_amount:discount,additional_amount:additional,line_amount:Math.max(0,unit*qty-discount+additional),note:String(x.note??"").trim()||null,sort_order:i};});
 if(items.some(x=>!x.item_name)) return NextResponse.json({ok:false,message:"수납 항목명을 확인해 주세요."},{status:400});
 const subtotal=items.reduce((s,x)=>s+x.line_amount,0),invoiceDiscount=Math.max(0,Math.round(Number(body.invoiceDiscount)||0)),total=Math.max(0,subtotal-invoiceDiscount);
 const payments=(Array.isArray(body.payments)?body.payments:[]).map(x=>({method:["cash","card","transfer","other"].includes(String(x.method))?String(x.method):"other",amount:Math.max(0,Math.round(Number(x.amount)||0)),approval_number:String(x.approvalNumber??"").trim()||null,memo:String(x.memo??"").trim()||null})).filter(x=>x.amount>0);
 const paid=payments.reduce((s,x)=>s+x.amount,0); if(paid>total) return NextResponse.json({ok:false,message:"결제 금액이 최종 금액보다 큽니다."},{status:400});
 const outstanding=total-paid,status=paid===0?"payment_pending":outstanding===0?"paid":"partially_paid";
 const {data:receipt,error:receiptError}=await supabaseAdmin.rpc("pawu_next_receipt_number",{p_hospital_id:access.hospitalId,p_date:new Date().toISOString().slice(0,10)}); if(receiptError) return NextResponse.json({ok:false,message:receiptError.message},{status:400});
 const {data:invoice,error}=await supabaseAdmin.from("hospital_invoices").insert({hospital_id:access.hospitalId,reservation_id:body.reservationId??null,pet_id:petId,status,subtotal_amount:subtotal,discount_amount:invoiceDiscount,total_amount:total,paid_amount:paid,outstanding_amount:outstanding,receipt_number:receipt,memo:String(body.memo??"").trim()||null,payment_method:payments.length===1?payments[0].method:payments.length>1?"mixed":null,paid_at:status==="paid"?new Date().toISOString():null,completed_by:status==="paid"?access.userId:null,created_by:access.userId}).select("id,receipt_number").single();
 if(error||!invoice) return NextResponse.json({ok:false,message:error?.message??"수납서 생성 실패"},{status:400});
 const {error:itemError}=await supabaseAdmin.from("hospital_invoice_items").insert(items.map(x=>({...x,invoice_id:invoice.id}))); if(itemError){await supabaseAdmin.from("hospital_invoices").delete().eq("id",invoice.id);return NextResponse.json({ok:false,message:itemError.message},{status:400});}
 if(payments.length){const {error:payError}=await supabaseAdmin.from("hospital_payment_transactions").insert(payments.map(x=>({...x,hospital_id:access.hospitalId,invoice_id:invoice.id,processed_by:access.userId})));if(payError)return NextResponse.json({ok:false,message:payError.message},{status:400});}
 if(body.waitingEntryId){await supabaseAdmin.from("hospital_waiting_entries").update({status:status==="paid"?"completed":"billing",updated_at:new Date().toISOString()}).eq("id",body.waitingEntryId).eq("hospital_id",access.hospitalId);}
 if(body.reservationId&&status==="paid") await supabaseAdmin.from("reservations").update({status:"completed"}).eq("id",body.reservationId).eq("hospital_id",access.hospitalId);
 return NextResponse.json({ok:true,invoiceId:invoice.id,receiptNumber:invoice.receipt_number,totalAmount:total,paidAmount:paid,outstandingAmount:outstanding,status});
}
