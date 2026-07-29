-- PAWU V7.6.1
-- 보호자용 진료 결과 안내 필드
-- 기존 데이터 삭제 없음

begin;

alter table public.medical_records
  add column if not exists guardian_summary text,
  add column if not exists care_instructions text,
  add column if not exists medication_instructions text,
  add column if not exists next_visit_date date;

-- 작성 중에는 비어 있을 수 있음
alter table public.medical_records
  alter column guardian_summary drop not null,
  alter column care_instructions drop not null,
  alter column medication_instructions drop not null,
  alter column next_visit_date drop not null;

commit;
