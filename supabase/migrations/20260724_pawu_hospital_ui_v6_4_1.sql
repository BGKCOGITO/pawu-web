-- PAWU HOSPITAL UI V6.4.1
-- 화면 통합 버전입니다.
-- 필수 신규 테이블은 없으며 대시보드 조회 성능용 인덱스만 보완합니다.

create index if not exists emr_records_hospital_status_updated_idx
  on public.emr_records(hospital_id, status, updated_at desc);

create index if not exists lab_orders_hospital_status_updated_idx
  on public.lab_orders(hospital_id, status, updated_at desc);

create index if not exists hospital_invoices_hospital_status_created_idx
  on public.hospital_invoices(hospital_id, status, created_at desc);

create index if not exists inventory_items_hospital_active_stock_idx
  on public.inventory_items(hospital_id, is_active, current_quantity, minimum_quantity);

-- V6.4.2에서 병원별 기능 표시, 메뉴 순서, 위젯 설정 테이블을 추가합니다.
