# CHANGELOG

## V9.7.0 - 내구성 있는 푸시 발송 구조
### 추가
- `push_jobs` 비동기 FCM 발송 큐
- 병원 발신 `chat_messages INSERT` 자동 감지 DB trigger
- 발송 작업 중복 방지 키
- 최대 5회 지수형 재시도와 실패 사유 기록
- Supabase Edge Function `process-push-jobs`
- 만료·해지 FCM 토큰 자동 비활성화
- notification+data 혼합 FCM payload 및 Web Push high urgency

### 수정
- 채팅 API 내부의 직접 FCM 발송 제거
- 푸시 발송을 채팅 HTTP 요청과 완전히 분리
- Service Worker가 notification payload를 다시 표시하지 않도록 중복 방지
- PWA 캐시 버전을 `pawu-shell-v9.7.0`으로 갱신

### 오류 수정
- 메시지는 저장되지만 Vercel 요청 종료·네트워크 상태에 따라 푸시가 누락될 수 있던 문제
- 앱 종료·다른 화면·잠금 상태에서 발송 신뢰도가 일정하지 않던 문제
- 발송 실패 원인과 재시도 상태를 확인할 수 없던 문제

### 기존 기능 영향
- 채팅 저장, 채팅 목록, Realtime 수신, 앱 내부 알림은 유지
- 보호자→병원 메시지에는 시스템 푸시 작업을 만들지 않음
- 병원→보호자 메시지만 사용자 알림 설정을 확인해 작업 생성
- Edge Function/Webhook 설정 전에는 새 큐가 생성돼도 자동 처리되지 않음

## V9.6.4 - 보호자 채팅 수신 핫픽스
### 수정
- 모바일 PWA에서 Realtime 이벤트가 누락될 때 마지막 메시지 이후만 가볍게 보조 동기화

## V9.6.3 - 성능 안정화
### 수정
- 채팅 및 병원 화면 반복 전체 조회 축소
- 백그라운드 불필요 조회 중지

## V9.6.2 - FCM 안정화
### 수정
- Firebase 설정 진단 및 Service Worker 통합
- 만료 토큰 비활성화


## V9.7.1 푸시 토큰 등록 진단
- 알림 권한과 FCM 토큰 DB 등록 상태를 분리해 표시한다.
- `/api/push/register` GET으로 현재 사용자의 활성 토큰 존재 여부를 확인한다.
- 토큰 저장 성공 후 화면 상태를 즉시 갱신한다.
