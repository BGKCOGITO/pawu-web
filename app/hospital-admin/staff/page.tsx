"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Role = "veterinarian" | "nurse" | "receptionist";
type PermissionKey =
  | "view_dashboard" | "manage_reservations" | "view_patients" | "view_medical_records"
  | "write_medical_records" | "manage_prescriptions" | "manage_dispensing" | "manage_inventory"
  | "manage_inpatient" | "manage_surgery" | "manage_billing" | "manage_attachments"
  | "view_audit_logs" | "export_data" | "manage_staff" | "manage_security";

type Staff = {
  id: number;
  user_id: string;
  display_name: string;
  email: string;
  role: Role;
  permissions: Record<string, boolean> | null;
  is_active: boolean;
  created_at: string;
};

const roleLabel: Record<Role, string> = {
  veterinarian: "수의사",
  nurse: "간호·테크니션",
  receptionist: "접수 직원",
};

const permissionGroups: { title: string; items: { key: PermissionKey; label: string; help: string }[] }[] = [
  { title: "기본 업무", items: [
    { key: "view_dashboard", label: "대시보드", help: "병원 운영 현황 조회" },
    { key: "manage_reservations", label: "예약·접수", help: "예약 승인 및 접수 업무" },
    { key: "view_patients", label: "환자 조회", help: "환자 및 보호자 기본정보 조회" },
  ]},
  { title: "진료", items: [
    { key: "view_medical_records", label: "진료기록 조회", help: "EMR 및 기존 기록 읽기" },
    { key: "write_medical_records", label: "진료기록 작성", help: "SOAP·진료기록 작성 및 수정" },
    { key: "manage_prescriptions", label: "처방", help: "처방 등록 및 변경" },
    { key: "manage_dispensing", label: "조제", help: "약품 조제 및 완료 처리" },
  ]},
  { title: "입원·운영", items: [
    { key: "manage_inpatient", label: "입원 관리", help: "활력징후·투약·수액·경과 기록" },
    { key: "manage_surgery", label: "수술 관리", help: "수술 일정 및 기록 관리" },
    { key: "manage_inventory", label: "재고 관리", help: "약품·소모품 재고 변경" },
    { key: "manage_billing", label: "수납 관리", help: "결제 및 수납 상태 변경" },
    { key: "manage_attachments", label: "첨부파일", help: "검사 결과와 사진 업로드" },
  ]},
  { title: "관리자", items: [
    { key: "view_audit_logs", label: "감사 로그", help: "중요 작업 이력 조회" },
    { key: "export_data", label: "데이터 내보내기", help: "병원 데이터 파일 생성" },
    { key: "manage_staff", label: "직원 관리", help: "직원 등록과 권한 변경" },
    { key: "manage_security", label: "보안 설정", help: "병원 보안 정책 관리" },
  ]},
];

const roleDefaults: Record<Role, Record<PermissionKey, boolean>> = {
  veterinarian: { view_dashboard:true,manage_reservations:true,view_patients:true,view_medical_records:true,write_medical_records:true,manage_prescriptions:true,manage_dispensing:false,manage_inventory:false,manage_inpatient:true,manage_surgery:true,manage_billing:false,manage_attachments:true,view_audit_logs:false,export_data:false,manage_staff:false,manage_security:false },
  nurse: { view_dashboard:true,manage_reservations:true,view_patients:true,view_medical_records:true,write_medical_records:false,manage_prescriptions:false,manage_dispensing:true,manage_inventory:true,manage_inpatient:true,manage_surgery:false,manage_billing:false,manage_attachments:true,view_audit_logs:false,export_data:false,manage_staff:false,manage_security:false },
  receptionist: { view_dashboard:true,manage_reservations:true,view_patients:true,view_medical_records:false,write_medical_records:false,manage_prescriptions:false,manage_dispensing:false,manage_inventory:false,manage_inpatient:false,manage_surgery:false,manage_billing:true,manage_attachments:false,view_audit_logs:false,export_data:false,manage_staff:false,manage_security:false },
};

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function StaffPage() {
  const [items, setItems] = useState<Staff[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("veterinarian");
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>({ ...roleDefaults.veterinarian });
  const [selected, setSelected] = useState<Staff | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  const activeCount = useMemo(() => items.filter((item) => item.is_active).length, [items]);

  async function load() {
    setLoading(true); setError("");
    const accessToken = await token();
    if (!accessToken) { setError("병원 계정으로 다시 로그인해 주세요."); setLoading(false); return; }
    const response = await fetch("/api/hospital/staff", { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const json = await response.json() as { message?: string; items?: Staff[]; currentUserId?: string };
    if (!response.ok) setError(json.message ?? "직원 목록을 불러오지 못했습니다.");
    else { setItems(json.items ?? []); setCurrentUserId(json.currentUserId ?? ""); }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function changeRole(next: Role) {
    setRole(next);
    setPermissions({ ...roleDefaults[next] });
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(""); setError(""); setSaving(true);
    const accessToken = await token();
    const response = await fetch("/api/hospital/staff", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ email, name, role, permissions }),
    });
    const json = await response.json() as { message?: string };
    if (!response.ok) setError(json.message ?? "직원 등록에 실패했습니다.");
    else { setMessage("직원을 등록했습니다."); setEmail(""); setName(""); await load(); }
    setSaving(false);
  }

  function openEdit(item: Staff) {
    setSelected({ ...item, permissions: { ...roleDefaults[item.role], ...(item.permissions ?? {}) } });
    setMessage(""); setError("");
  }

  async function saveSelected() {
    if (!selected) return;
    setSaving(true); setMessage(""); setError("");
    const accessToken = await token();
    const response = await fetch("/api/hospital/staff", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id:selected.id, displayName:selected.display_name, role:selected.role, permissions:selected.permissions, isActive:selected.is_active }),
    });
    const json = await response.json() as { message?: string };
    if (!response.ok) setError(json.message ?? "변경사항 저장에 실패했습니다.");
    else { setMessage("직원 권한을 저장했습니다."); setSelected(null); await load(); }
    setSaving(false);
  }

  return <main className="p-4 lg:p-6"><div className="mx-auto max-w-[1500px]">
    <header className="mb-5 border-b border-slate-300 pb-5">
      <p className="text-xs font-black tracking-[0.18em] text-slate-500">V8.5 HOSPITAL BETA</p>
      <h1 className="mt-1 text-2xl font-black">직원 및 권한 관리</h1>
      <p className="mt-2 text-sm text-slate-600">역할 기본값을 적용한 뒤 직원별로 필요한 권한만 조정합니다.</p>
    </header>

    <section className="mb-5 grid gap-3 sm:grid-cols-3">
      <div className="border border-slate-300 bg-white p-4"><p className="text-xs font-bold text-slate-500">전체 직원</p><p className="mt-2 text-2xl font-black">{items.length}명</p></div>
      <div className="border border-slate-300 bg-white p-4"><p className="text-xs font-bold text-slate-500">사용 중</p><p className="mt-2 text-2xl font-black">{activeCount}명</p></div>
      <div className="border border-slate-300 bg-white p-4"><p className="text-xs font-bold text-slate-500">중지</p><p className="mt-2 text-2xl font-black">{items.length-activeCount}명</p></div>
    </section>

    {message && <p className="mb-4 border border-emerald-300 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p>}
    {error && <p className="mb-4 border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

    <section className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <form onSubmit={submit} className="border border-slate-300 bg-white">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-black">새 직원 등록</h2><p className="mt-1 text-xs text-slate-500">직원이 먼저 PAWU 회원가입을 완료해야 합니다.</p></div>
        <div className="space-y-4 p-5">
          <label className="block text-sm font-bold">이름<input required value={name} onChange={(e)=>setName(e.target.value)} className="mt-2 w-full border border-slate-300 px-3 py-2.5 font-normal" placeholder="직원 이름" /></label>
          <label className="block text-sm font-bold">가입 이메일<input required type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="mt-2 w-full border border-slate-300 px-3 py-2.5 font-normal" placeholder="PAWU 가입 이메일" /></label>
          <label className="block text-sm font-bold">역할<select value={role} onChange={(e)=>changeRole(e.target.value as Role)} className="mt-2 w-full border border-slate-300 px-3 py-2.5 font-normal"><option value="veterinarian">수의사</option><option value="nurse">간호·테크니션</option><option value="receptionist">접수 직원</option></select></label>
          <PermissionEditor value={permissions} onChange={setPermissions} />
          <button disabled={saving} className="w-full bg-slate-950 px-4 py-3 font-black text-white disabled:opacity-50">{saving?"저장 중...":"직원 등록"}</button>
        </div>
      </form>

      <section className="border border-slate-300 bg-white">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-black">등록된 직원</h2><p className="mt-1 text-xs text-slate-500">행을 선택하면 역할·권한·사용 상태를 변경할 수 있습니다.</p></div>
        {loading ? <p className="p-8 text-sm text-slate-500">불러오는 중...</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-100 text-xs"><tr><th className="p-3">이름</th><th className="p-3">이메일</th><th className="p-3">역할</th><th className="p-3">상태</th><th className="p-3">관리</th></tr></thead><tbody>{items.map((item)=><tr key={item.id} className="border-t border-slate-200"><td className="p-3 font-bold">{item.display_name}{item.user_id===currentUserId&&<span className="ml-2 text-xs text-blue-600">본인</span>}</td><td className="p-3">{item.email}</td><td className="p-3">{roleLabel[item.role]??item.role}</td><td className="p-3"><span className={item.is_active?"font-bold text-emerald-700":"font-bold text-slate-400"}>{item.is_active?"사용 중":"중지"}</span></td><td className="p-3"><button type="button" onClick={()=>openEdit(item)} className="border border-slate-400 px-3 py-1.5 font-bold">권한 설정</button></td></tr>)}</tbody></table>{items.length===0&&<p className="p-8 text-center text-sm text-slate-500">등록된 직원이 없습니다.</p>}</div>}
      </section>
    </section>

    {selected && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 p-5"><div><p className="text-xs font-black tracking-widest text-slate-500">STAFF PERMISSION</p><h2 className="mt-1 text-xl font-black">{selected.display_name} 권한 설정</h2><p className="mt-1 text-sm text-slate-500">{selected.email}</p></div><button onClick={()=>setSelected(null)} className="border border-slate-300 px-3 py-2 font-bold">닫기</button></div><div className="space-y-4 p-5"><label className="block text-sm font-bold">표시 이름<input value={selected.display_name} onChange={(e)=>setSelected({...selected,display_name:e.target.value})} className="mt-2 w-full border border-slate-300 px-3 py-2.5 font-normal" /></label><label className="block text-sm font-bold">역할<select value={selected.role} onChange={(e)=>{const next=e.target.value as Role;setSelected({...selected,role:next,permissions:{...roleDefaults[next]}})}} className="mt-2 w-full border border-slate-300 px-3 py-2.5 font-normal"><option value="veterinarian">수의사</option><option value="nurse">간호·테크니션</option><option value="receptionist">접수 직원</option></select></label><PermissionEditor value={{...roleDefaults[selected.role],...(selected.permissions??{})} as Record<PermissionKey,boolean>} onChange={(next)=>setSelected({...selected,permissions:next})} /><label className="flex items-center justify-between border border-slate-300 p-4"><span><span className="block font-black">계정 사용</span><span className="text-xs text-slate-500">중지하면 병원 프로그램에 접근할 수 없습니다.</span></span><input type="checkbox" checked={selected.is_active} disabled={selected.user_id===currentUserId} onChange={(e)=>setSelected({...selected,is_active:e.target.checked})} className="h-5 w-5" /></label><button disabled={saving} onClick={()=>void saveSelected()} className="w-full bg-slate-950 px-4 py-3 font-black text-white disabled:opacity-50">{saving?"저장 중...":"변경사항 저장"}</button></div></div></div>}
  </div></main>;
}

function PermissionEditor({ value, onChange }: { value: Record<PermissionKey, boolean>; onChange: (next: Record<PermissionKey, boolean>) => void }) {
  return <div className="border border-slate-300"><div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><p className="text-sm font-black">세부 권한</p><p className="mt-1 text-xs text-slate-500">역할을 선택하면 기본 권한이 적용됩니다.</p></div><div className="divide-y divide-slate-200">{permissionGroups.map((group)=><div key={group.title} className="p-4"><p className="mb-3 text-xs font-black tracking-widest text-slate-500">{group.title}</p><div className="grid gap-2 sm:grid-cols-2">{group.items.map((item)=><label key={item.key} className="flex cursor-pointer items-start gap-3 border border-slate-200 p-3"><input type="checkbox" checked={value[item.key]===true} onChange={(e)=>onChange({...value,[item.key]:e.target.checked})} className="mt-1 h-4 w-4" /><span><span className="block text-sm font-bold">{item.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{item.help}</span></span></label>)}</div></div>)}</div></div>;
}
