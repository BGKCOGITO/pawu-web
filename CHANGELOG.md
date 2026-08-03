# CHANGELOG

## V9.7.2 - 푸시 운영 안정화
### 추가
- 5분 이상 멈춘 processing 작업 자동 복구
- 성공·건너뜀 30일, 최종 실패 90일 보관 후 정리
- 재시도 RPC와 큐 통계 View
- 1분 주기 retry worker Cron 템플릿
- 관리자 푸시 발송 상태 화면 및 수동 재시도

### 수정
- Edge Function 호출 시 stale 작업 복구와 오래된 기록 정리를 함께 수행
- 처리 결과에 recovered/cleaned 운영 지표 포함

### 기존 기능 영향
- 채팅 저장과 화면 수신 로직은 변경하지 않음
- 기존 Firebase 토큰과 Webhook secret을 그대로 사용
- 새 SQL과 Edge Function 재배포 후 운영 기능 활성화

## V9.7.1 - FCM 토큰 등록 진단
- 권한 허용과 DB 토큰 등록 상태 분리

## V9.7.0 - 내구성 있는 푸시 큐
- DB Trigger, push_jobs, Edge Function 기반 FCM 발송 구조
