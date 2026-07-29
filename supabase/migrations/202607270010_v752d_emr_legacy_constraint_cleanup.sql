-- PAWU V7.5.2-D
-- 기존 전자차트 테이블의 구형 필드 NOT NULL 제약을 일괄 정리
-- 기존 데이터 삭제 없음

begin;

-- ---------------------------------------------------------
-- medical_records
-- 아래 핵심 연결/상태 컬럼을 제외한 모든 기존·신규 컬럼은
-- draft 차트 생성 시 비어 있을 수 있으므로 NULL 허용
-- ---------------------------------------------------------

do $$
declare
  column_row record;
begin
  for column_row in
    select
      a.attname as column_name
    from pg_attribute a
    where a.attrelid = 'public.medical_records'::regclass
      and a.attnum > 0
      and not a.attisdropped
      and a.attnotnull
      and a.attname not in (
        'id',
        'hospital_id',
        'hospital_patient_id',
        'pet_id',
        'status',
        'created_at',
        'updated_at'
      )
  loop
    execute format(
      'alter table public.medical_records alter column %I drop not null',
      column_row.column_name
    );
  end loop;
end
$$;

-- draft 상태 기본값 보장
alter table public.medical_records
  alter column status set default 'draft';

update public.medical_records
set status = 'draft'
where status is null;

alter table public.medical_records
  alter column status set not null;

-- ---------------------------------------------------------
-- medical_prescriptions
-- 필수 컬럼 외 구형 보조 필드도 NULL 허용
-- ---------------------------------------------------------

do $$
declare
  column_row record;
begin
  for column_row in
    select
      a.attname as column_name
    from pg_attribute a
    where a.attrelid = 'public.medical_prescriptions'::regclass
      and a.attnum > 0
      and not a.attisdropped
      and a.attnotnull
      and a.attname not in (
        'id',
        'medical_record_id',
        'hospital_id',
        'medication_name',
        'created_at'
      )
  loop
    execute format(
      'alter table public.medical_prescriptions alter column %I drop not null',
      column_row.column_name
    );
  end loop;
end
$$;

commit;

-- 확인용: 현재 medical_records의 NOT NULL 컬럼 목록
select
  column_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'medical_records'
  and is_nullable = 'NO'
order by ordinal_position;
