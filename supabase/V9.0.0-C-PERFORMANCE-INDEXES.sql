-- PAWU V9.0.0-C performance indexes
-- Supabase SQL Editor에서 1회 실행하세요.

create extension if not exists pg_trgm;

create index if not exists hospitals_public_active_name_idx
  on public.hospitals (name)
  where is_active = true and is_published = true;
create index if not exists hospitals_region_public_idx
  on public.hospitals (region_level1, region_level2)
  where is_active = true and is_published = true;
create index if not exists hospitals_name_trgm_idx on public.hospitals using gin (name gin_trgm_ops);
create index if not exists hospitals_address_trgm_idx on public.hospitals using gin (address gin_trgm_ops);
create index if not exists hospitals_road_address_trgm_idx on public.hospitals using gin (road_address gin_trgm_ops);

create index if not exists reservations_hospital_date_status_idx
  on public.reservations (hospital_id, reservation_date desc, status);
create index if not exists reservations_user_created_idx
  on public.reservations (user_id, created_at desc);
create index if not exists medical_records_hospital_created_idx
  on public.medical_records (hospital_id, created_at desc);
create index if not exists medical_records_pet_created_idx
  on public.medical_records (pet_id, created_at desc);
create index if not exists hospitalizations_hospital_status_created_idx
  on public.hospitalizations (hospital_id, status, created_at desc);
create index if not exists ai_usage_hospital_created_idx
  on public.ai_medical_usage_logs (hospital_id, created_at desc);
create index if not exists audit_logs_hospital_created_idx
  on public.audit_logs (hospital_id, created_at desc);

analyze public.hospitals;
analyze public.reservations;
analyze public.medical_records;
