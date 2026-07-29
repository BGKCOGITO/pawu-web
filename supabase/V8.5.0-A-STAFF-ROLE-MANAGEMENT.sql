-- PAWU V8.5.0-A 직원 역할·권한 관리
-- 기존 데이터 삭제 없음 / 여러 번 실행 가능

alter table if exists public.hospital_staff
  add column if not exists permissions jsonb not null default '{}'::jsonb;

alter table if exists public.hospital_staff
  add column if not exists is_active boolean not null default true;

create unique index if not exists hospital_staff_hospital_user_unique
  on public.hospital_staff(hospital_id, user_id);

-- 기존 직원 권한을 역할 기본값으로 보강합니다. 이미 저장된 개별 권한은 유지됩니다.
update public.hospital_staff
set permissions =
  case role
    when 'veterinarian' then '{"view_dashboard":true,"manage_reservations":true,"view_patients":true,"view_medical_records":true,"write_medical_records":true,"manage_prescriptions":true,"manage_dispensing":false,"manage_inventory":false,"manage_inpatient":true,"manage_surgery":true,"manage_billing":false,"manage_attachments":true,"view_audit_logs":false,"export_data":false,"manage_staff":false,"manage_security":false}'::jsonb
    when 'nurse' then '{"view_dashboard":true,"manage_reservations":true,"view_patients":true,"view_medical_records":true,"write_medical_records":false,"manage_prescriptions":false,"manage_dispensing":true,"manage_inventory":true,"manage_inpatient":true,"manage_surgery":false,"manage_billing":false,"manage_attachments":true,"view_audit_logs":false,"export_data":false,"manage_staff":false,"manage_security":false}'::jsonb
    when 'receptionist' then '{"view_dashboard":true,"manage_reservations":true,"view_patients":true,"view_medical_records":false,"write_medical_records":false,"manage_prescriptions":false,"manage_dispensing":false,"manage_inventory":false,"manage_inpatient":false,"manage_surgery":false,"manage_billing":true,"manage_attachments":false,"view_audit_logs":false,"export_data":false,"manage_staff":false,"manage_security":false}'::jsonb
    else coalesce(permissions, '{}'::jsonb)
  end || coalesce(permissions, '{}'::jsonb)
where role in ('veterinarian','nurse','receptionist');
