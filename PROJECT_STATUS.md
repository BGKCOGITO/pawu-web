# PAWU PROJECT STATUS

## 현재 버전
V9.7.2 푸시 운영 안정화

## 현재 정상 작동하는 기능
- 보호자/병원 채팅 송수신
- 앱 종료·백그라운드·다른 화면 상태 병원→보호자 FCM 알림
- FCM 토큰 등록 및 활성 토큰 조회
- push_jobs 큐, Database Webhook, process-push-jobs Edge Function

## 최근 완료한 작업
- Vercel Firebase 환경변수 등록
- Edge Function URL 및 서비스 계정 JSON 오류 해결
- 보호자 FCM 토큰 등록 정상화
- 병원 메시지 푸시 실수신 확인
- stale processing 자동 복구 및 오래된 작업 정리 함수 추가
- 관리자 푸시 운영 화면 추가

## 지금 진행 중인 작업
- 1분 주기 retry worker cron 적용
- 관리자 화면 및 재시도 버튼 운영 테스트

## 발견된 오류와 미해결 문제
- Cron 미설정 시 retry 작업은 다음 worker 호출 전까지 대기할 수 있음
- Android 제조사 절전 정책은 기기별 설정 영향 가능

## 다음에 진행할 정확한 작업
1. V9.7.2 migration 실행
2. Edge Function 재배포
3. Cron template 값 교체 후 실행
4. /admin/push-operations 확인
5. 앱 네 상태 푸시 테스트

## 마지막으로 수정한 파일 목록
- supabase/migrations/20260803_pawu_v9_7_2_push_operations.sql
- supabase/migrations/20260803_pawu_v9_7_2_push_worker_cron_TEMPLATE.sql
- supabase/functions/process-push-jobs/index.ts
- app/api/platform/push-operations/route.ts
- app/admin/push-operations/page.tsx
- app/admin/operations/page.tsx
- PAWU_MASTER.md
- PROJECT_STATUS.md
- CHANGELOG.md

## 사용자 테스트가 필요한 항목
- 새 메시지 push_jobs sent 전환
- processing 5분 초과 작업 복구
- retry 작업 1분 이내 재처리
- 관리자 화면 통계 및 재시도
- 앱 전면/다른 화면/백그라운드/완전 종료 푸시
