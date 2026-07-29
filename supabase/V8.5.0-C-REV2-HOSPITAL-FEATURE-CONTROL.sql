-- PAWU V8.5.0-C REV2
-- 병원별 기능 ON/OFF 설정
-- 중요: 기존 hospital_feature_settings 테이블은 과거 UI 설정에서 사용 중이므로
--       충돌을 피하기 위해 hospital_module_settings 테이블을 별도로 사용합니다.
-- 기존 데이터 삭제 없음 / 여러 번 실행 가능

create table if not exists public.hospital_module_settings (
  hospital_id bigint primary key references public.hospitals(id) on delete cascade,
  inpatient_enabled boolean not null default true,
  surgery_enabled boolean not null default true,
  inventory_enabled boolean not null default true,
  dispensing_enabled boolean not null default true,
  billing_enabled boolean not null default true,
  lab_enabled boolean not null default true,
  guardian_chat_enabled boolean not null default true,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.hospital_module_settings enable row level security;

create index if not exists hospital_module_settings_updated_at_idx
  on public.hospital_module_settings(updated_at desc);

insert into public.hospital_module_settings (hospital_id)
select h.id
from public.hospitals h
where not exists (
  select 1
  from public.hospital_module_settings s
  where s.hospital_id = h.id
);
