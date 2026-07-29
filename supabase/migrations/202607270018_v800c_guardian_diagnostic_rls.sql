-- PAWU V8.0.0-C
-- 보호자 검사 결과 공개 권한
-- 기존 데이터 삭제 없음

begin;

drop policy if exists "guardian_can_read_visible_diagnostic_orders"
  on public.diagnostic_orders;

create policy "guardian_can_read_visible_diagnostic_orders"
on public.diagnostic_orders
for select
to authenticated
using (
  is_guardian_visible = true
  and status = 'completed'
  and exists (
    select 1
    from public.medical_records mr
    join public.reservations r
      on r.id = mr.reservation_id
    where mr.id = diagnostic_orders.medical_record_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists "guardian_can_read_visible_diagnostic_results"
  on public.diagnostic_result_items;

create policy "guardian_can_read_visible_diagnostic_results"
on public.diagnostic_result_items
for select
to authenticated
using (
  exists (
    select 1
    from public.diagnostic_orders d
    join public.medical_records mr
      on mr.id = d.medical_record_id
    join public.reservations r
      on r.id = mr.reservation_id
    where d.id = diagnostic_result_items.diagnostic_order_id
      and d.is_guardian_visible = true
      and d.status = 'completed'
      and r.user_id = auth.uid()
  )
);

drop policy if exists "guardian_can_read_visible_diagnostic_files"
  on public.diagnostic_files;

create policy "guardian_can_read_visible_diagnostic_files"
on public.diagnostic_files
for select
to authenticated
using (
  is_guardian_visible = true
  and exists (
    select 1
    from public.diagnostic_orders d
    join public.medical_records mr
      on mr.id = d.medical_record_id
    join public.reservations r
      on r.id = mr.reservation_id
    where d.id = diagnostic_files.diagnostic_order_id
      and d.is_guardian_visible = true
      and d.status = 'completed'
      and r.user_id = auth.uid()
  )
);

commit;
