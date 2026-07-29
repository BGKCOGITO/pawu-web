-- PAWU V7.5.2-C
-- 기존 EMR 스키마의 doctor_note NOT NULL 제약 호환 수정
-- 기존 데이터 삭제 없음

begin;

-- 구형 전자차트에서 사용하던 doctor_note 컬럼이 없으면 추가
alter table if exists public.medical_records
  add column if not exists doctor_note text;

-- draft 차트 생성 전에는 비어 있을 수 있으므로 NULL 허용
alter table if exists public.medical_records
  alter column doctor_note drop not null;

-- 기존 NULL 데이터는 빈 문자열로 정리
update public.medical_records
set doctor_note = ''
where doctor_note is null;

commit;
