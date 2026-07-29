-- PAWU V7.5.2
-- 전자차트 draft 생성 시 빈 진단/처치/SOAP 필드를 허용하도록 제약조건 정리
-- 기존 데이터 삭제 없음

begin;

-- 전자차트 작성 전 비어 있을 수 있는 필드는 모두 NULL 허용
alter table if exists public.medical_records
  alter column guardian_information drop not null,
  alter column ai_reference_summary drop not null,
  alter column chief_complaint drop not null,
  alter column subjective drop not null,
  alter column objective drop not null,
  alter column assessment drop not null,
  alter column plan drop not null,
  alter column diagnosis drop not null,
  alter column treatment drop not null,
  alter column follow_up drop not null,
  alter column veterinarian_note drop not null,
  alter column completed_at drop not null,
  alter column reservation_id drop not null,
  alter column veterinarian_user_id drop not null;

-- 처방도 작성 중 비어 있을 수 있는 보조 필드는 NULL 허용
alter table if exists public.medical_prescriptions
  alter column dosage drop not null,
  alter column frequency drop not null,
  alter column duration drop not null,
  alter column route drop not null,
  alter column instructions drop not null;

-- status 기본값과 필수 여부 보장
alter table if exists public.medical_records
  alter column status set default 'draft';

update public.medical_records
set status = 'draft'
where status is null;

alter table if exists public.medical_records
  alter column status set not null;

-- 핵심 연결 컬럼만 NOT NULL 유지
do $$
begin
  if not exists (
    select 1
    from public.medical_records
    where hospital_id is null
       or hospital_patient_id is null
       or pet_id is null
  ) then
    alter table public.medical_records
      alter column hospital_id set not null,
      alter column hospital_patient_id set not null,
      alter column pet_id set not null;
  end if;
end
$$;

-- 처방의 핵심 컬럼만 NOT NULL 유지
do $$
begin
  if not exists (
    select 1
    from public.medical_prescriptions
    where medical_record_id is null
       or hospital_id is null
       or medication_name is null
  ) then
    alter table public.medical_prescriptions
      alter column medical_record_id set not null,
      alter column hospital_id set not null,
      alter column medication_name set not null;
  end if;
end
$$;

commit;
