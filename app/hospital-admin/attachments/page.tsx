"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Pet={id:number;name:string};
export default function AttachmentsPage(){
 const [pets,setPets]=useState<Pet[]>([]);const [petId,setPetId]=useState("");const [file,setFile]=useState<File|null>(null);const [category,setCategory]=useState("image");const [message,setMessage]=useState("");const [uploading,setUploading]=useState(false);
 useEffect(()=>{async function load(){const {data:auth}=await supabase.auth.getUser();if(!auth.user)return;const {data:admin}=await supabase.from("hospital_admins").select("hospital_id").eq("user_id",auth.user.id).maybeSingle();let hid=admin?.hospital_id; if(!hid){const {data:s}=await supabase.from("hospital_staff").select("hospital_id").eq("user_id",auth.user.id).eq("is_active",true).maybeSingle();hid=s?.hospital_id}if(!hid)return;const {data:r}=await supabase.from("reservations").select("pets(id,name)").eq("hospital_id",hid).not("pet_id","is",null);const map=new Map<number,Pet>();(r??[]).forEach((x:any)=>{const p=Array.isArray(x.pets)?x.pets[0]:x.pets;if(p)map.set(p.id,p)});setPets([...map.values()])}void load()},[]);
 async function submit(e:FormEvent){e.preventDefault();if(!file||!petId)return;setUploading(true);setMessage("");const {data:auth}=await supabase.auth.getUser();if(!auth.user){setUploading(false);return}
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const path=`${petId}/${Date.now()}-${safe}`;
  const {error:up}=await supabase.storage.from("medical-attachments").upload(path,file,{upsert:false});if(up){setMessage(up.message);setUploading(false);return}
  const {data:url}=supabase.storage.from("medical-attachments").getPublicUrl(path);
  let hid:any=null;const {data:a}=await supabase.from("hospital_admins").select("hospital_id").eq("user_id",auth.user.id).maybeSingle();hid=a?.hospital_id;if(!hid){const {data:s}=await supabase.from("hospital_staff").select("hospital_id").eq("user_id",auth.user.id).eq("is_active",true).maybeSingle();hid=s?.hospital_id}
  const {error}=await supabase.from("medical_attachments").insert({hospital_id:hid,pet_id:Number(petId),uploaded_by:auth.user.id,file_name:file.name,file_path:path,file_type:category,mime_type:file.type,file_size:file.size,public_url:url.publicUrl});
  setMessage(error?error.message:"첨부파일을 저장했습니다.");setUploading(false);if(!error)setFile(null);
 }
 return <main className="min-h-screen bg-gray-50 px-5 py-8 text-black"><div className="mx-auto max-w-3xl"><Link href="/hospital-admin" className="rounded-xl border bg-white px-4 py-2 text-sm">← 병원관리자</Link><h1 className="mt-8 text-3xl font-black">사진·X-ray·PDF 첨부</h1><p className="mt-2 text-sm text-gray-600">환자 차트에 검사 이미지와 문서를 보관합니다.</p>{message&&<p className="mt-4 rounded-xl bg-white p-4 text-sm">{message}</p>}
 <form onSubmit={submit} className="mt-6 space-y-4 rounded-3xl border bg-white p-6"><select required value={petId} onChange={e=>setPetId(e.target.value)} className="w-full rounded-xl border p-3"><option value="">환자 선택</option>{pets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={category} onChange={e=>setCategory(e.target.value)} className="w-full rounded-xl border p-3"><option value="image">진료 사진</option><option value="xray">X-ray</option><option value="ultrasound">초음파</option><option value="lab">검사 결과</option><option value="pdf">PDF 문서</option></select><input required type="file" accept="image/*,.pdf" onChange={e=>setFile(e.target.files?.[0]??null)} className="w-full rounded-xl border p-3"/><button disabled={uploading} className="w-full rounded-xl bg-black p-4 font-bold text-white">{uploading?"업로드 중...":"차트에 첨부"}</button></form></div></main>
}
