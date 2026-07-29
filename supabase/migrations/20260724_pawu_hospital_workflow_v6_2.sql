-- PAWU HOSPITAL WORKFLOW V6.2
-- V5, V6, V6.1 적용 후 실행하세요.

alter table if exists public.reservations
  add column if not exists workflow_updated_at timestamptz not null default now();

create index if not exists reservations_hospital_date_status_idx
  on public.reservations(hospital_id, reservation_date, status, reservation_time);

create index if not exists hospital_invoices_hospital_reservation_idx
  on public.hospital_invoices(hospital_id, reservation_id, status);

create index if not exists hospital_invoices_inventory_review_idx
  on public.hospital_invoices(
    hospital_id,
    inventory_finalized_at,
    status,
    created_at desc
  );

-- 기존 예약의 workflow_updated_at이 비어 있을 경우 생성일 기준으로 보완합니다.
update public.reservations
set workflow_updated_at = coalesce(created_at, now())
where workflow_updated_at is null;

-- V6.2는 기존 예약 status 값을 그대로 사용합니다.
-- requested / approved / arrived / in_progress / payment_pending / completed / cancelled
-- 진료 완료 요청 시 재고 확정 여부를 서버 API에서 검증합니다.
