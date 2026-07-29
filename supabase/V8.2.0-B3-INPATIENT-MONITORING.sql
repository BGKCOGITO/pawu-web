-- PAWU V8.2.0-B3
-- 수동 입력 기반 입원 활력징후 모니터링
-- 기존 데이터 삭제 없음

begin;

alter table public.hospitalization_events
  add column if not exists oxygen_saturation_pct numeric;

alter table public.hospitalization_events
  drop constraint if exists hospitalization_events_oxygen_saturation_check;

alter table public.hospitalization_events
  add constraint hospitalization_events_oxygen_saturation_check
  check (
    oxygen_saturation_pct is null
    or oxygen_saturation_pct between 0 and 100
  );

commit;
