import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import { getHospitalAccess, readBearer } from "../../../../../lib/hospital-access";
export async function GET(request: Request) {
  const access = await getHospitalAccess(readBearer(request));
  if (!access) return NextResponse.json({ok:false,message:"병원 로그인이 필요합니다."},{status:401});
  const url=new URL(request.url); const date=url.searchParams.get("date") || new Date().toISOString().slice(0,10);
  const start=`${date}T00:00:00.000Z`; const end=`${date}T23:59:59.999Z`;
  const [waitingResult, invoiceResult, catalogResult] = await Promise.all([
    supabaseAdmin.from("hospital_waiting_entries").select("id,reservation_id,pet_id,pet_name,guardian_name,phone,status,waiting_number,visit_reason,checked_in_at").eq("hospital_id",access.hospitalId).eq("waiting_date",date).in("status",["billing","completed"]).order("waiting_number"),
    supabaseAdmin.from("hospital_invoices").select("id,reservation_id,pet_id,status,subtotal_amount,discount_amount,total_amount,paid_amount,outstanding_amount,receipt_number,paid_at,created_at,pets(name),hospital_payment_transactions(id,method,amount,approval_number,processed_at,status)").eq("hospital_id",access.hospitalId).gte("created_at",start).lte("created_at",end).order("created_at",{ascending:false}),
    supabaseAdmin.from("hospital_service_items").select("id,name,category,default_price,is_favorite,is_active").eq("hospital_id",access.hospitalId).eq("is_active",true).order("is_favorite",{ascending:false}).order("category").order("name")
  ]);
  const error=waitingResult.error||invoiceResult.error||catalogResult.error;
  if(error) return NextResponse.json({ok:false,message:error.message},{status:400});
  return NextResponse.json({ok:true,waiting:waitingResult.data??[],invoices:invoiceResult.data??[],catalog:catalogResult.data??[]});
}
