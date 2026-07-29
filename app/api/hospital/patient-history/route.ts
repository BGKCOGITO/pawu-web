import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { can, getHospitalAccess, readBearer } from "../../../../lib/hospital-access";

export async function POST(request:Request){
 const access=await getHospitalAccess(readBearer(request));
 if(!access||!can(access,"write_medical_records"))return NextResponse.json({ok:false,message:"진료기록 작성 권한이 없습니다."},{status:403});
 const body=await request.json() as Record<string,unknown>; const kind=String(body.kind??""); const petId=Number(body.petId);
 if(!Number.isInteger(petId)||!["exam","surgery"].includes(kind))return NextResponse.json({ok:false,message:"요청 값이 올바르지 않습니다."},{status:400});
 const base={hospital_id:access.hospitalId,pet_id:petId,created_by:access.userId};
 let error;
 if(kind==="exam"){
   ({error}=await supabaseAdmin.from("medical_exams").insert({...base,medical_record_id:body.medicalRecordId??null,exam_type:body.examType,exam_name:body.examName,result_summary:body.resultSummary??null,result_detail:body.resultDetail??null,performed_at:body.performedAt}));
 }else{
   ({error}=await supabaseAdmin.from("surgery_records").insert({...base,medical_record_id:body.medicalRecordId??null,surgery_name:body.surgeryName,procedure_notes:body.procedureNotes??null,surgeon_name:body.surgeonName??null,anesthesia_notes:body.anesthesiaNotes??null,performed_at:body.performedAt}));
 }
 if(error)return NextResponse.json({ok:false,message:error.message},{status:400});
 return NextResponse.json({ok:true});
}
