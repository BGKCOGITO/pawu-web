-- PAWU V9.2.0 병원 운영 대시보드 조회 최적화
begin;
create index if not exists reservations_hospital_date_time_idx on public.reservations (hospital_id, reservation_date, reservation_time);
create index if not exists hospitalizations_hospital_expected_discharge_idx on public.hospitalizations (hospital_id, expected_discharge_at) where status in ('planned','admitted','in_treatment','recovering','ready_for_discharge');
create index if not exists hospital_invoices_hospital_created_status_idx on public.hospital_invoices (hospital_id, created_at desc, status);
create index if not exists ai_medical_usage_logs_hospital_created_idx on public.ai_medical_usage_logs (hospital_id, created_at desc);
commit;
