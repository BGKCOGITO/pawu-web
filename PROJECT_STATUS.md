# PAWU PROJECT STATUS

## 현재 버전
V9.7.0 내구성 있는 푸시 발송 구조 패치

## 현재 정상 작동하는 기능
- 보호자/병원 로그인
- 예약 및 예약관리
- 보호자/병원 채팅 송수신
- 보호자 채팅방 실시간 수신 및 보조 동기화
- 앱 내부 알림
- 보호자 반려동물 관리
- 병원 DB 및 관리자 기능
- 보호자 FCM 토큰 등록
- Vercel Firebase 환경변수 등록 후 일부 상태에서 시스템 푸시 수신

## 최근 완료한 작업
- 최신 `PAWU.zip`의 실제 채팅 API, FCM 발송 코드, Service Worker 구조 확인
- 채팅 API 안에서 FCM을 직접 발송하던 구조 제거
- `chat_messages INSERT`를 감지해 `push_jobs`에 작업을 생성하는 DB trigger 추가
- 중복 방지, 최대 5회 재시도, 실패 사유 기록이 가능한 푸시 큐 추가
- Supabase Edge Function `process-push-jobs` 추가
- FCM notification+data payload와 Web Push 고우선순위 설정
- 만료 토큰 자동 비활성화
- Service Worker에서 notification payload 중복 표시 방지

## 지금 진행 중인 작업
- 운영 Supabase에 V9.7.0 migration 적용
- `process-push-jobs` Edge Function 배포
- Edge Function secrets 등록
- `push_jobs INSERT` Database Webhook 등록
- 1분 간격 retry 호출 설정

## 발견된 오류와 미해결 문제
- 기존 구조에서는 채팅 저장 요청 안에서 FCM을 발송해 앱 종료/다른 화면 상태에서 푸시가 간헐적으로 누락됨
- 기존 발송 오류는 로그와 재시도 작업이 없어 원인 추적이 어려웠음
- 새 구조는 Supabase Webhook과 Edge Function 배포가 완료되기 전까지 자동 푸시가 동작하지 않음
- Android 제조사 절전 정책 또는 Chrome/PWA 알림 차단은 애플리케이션 코드 외부 요인으로 남음

## 다음에 진행할 정확한 작업
1. 패치 ZIP을 `C:\Users\USER\pawu-web`에 덮어쓰기
2. Supabase SQL Editor에서 `supabase/migrations/20260802_pawu_v9_7_0_push_queue.sql` 실행
3. Supabase CLI 로그인 및 프로젝트 연결
4. `FIREBASE_SERVICE_ACCOUNT_JSON`, `PUSH_WORKER_SECRET`, `PAWU_PUBLIC_URL` Edge Function secrets 등록
5. `process-push-jobs` Edge Function 배포
6. `push_jobs` INSERT Database Webhook 생성
7. 1분 간격 retry 호출 설정
8. `npm run dev`로 기존 채팅 기능 확인
9. Git 커밋·푸시 후 Vercel 배포
10. 앱 전면/다른 화면/백그라운드/완전 종료·잠금 상태 네 가지 테스트

## 마지막으로 수정한 파일 목록
- `app/api/chat/messages/route.ts`
- `app/firebase-messaging-sw.js/route.ts`
- `supabase/migrations/20260802_pawu_v9_7_0_push_queue.sql`
- `supabase/functions/process-push-jobs/index.ts`
- `PAWU_MASTER.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `README-V9.7.0-DURABLE-PUSH.txt`

## 사용자 테스트가 필요한 항목
- 보호자→병원 및 병원→보호자 채팅 저장·실시간 표시
- 병원 메시지 저장 시 `push_jobs` 행 생성
- Webhook 호출 후 `push_jobs.status`가 `sent`로 변경
- 앱을 열고 채팅방에 있을 때 수신
- 앱을 열고 다른 화면에 있을 때 시스템 알림
- 앱이 백그라운드일 때 시스템 알림
- 앱을 완전히 닫고 잠금 상태일 때 시스템 알림
- 소리·진동·잠금화면 표시
- 알림 클릭 시 해당 채팅방 이동
- 동일 메시지 중복 알림 없음
- 실패 작업의 `retry/dead/last_error` 기록


## V9.7.1 푸시 토큰 등록 진단
- 알림 권한과 FCM 토큰 DB 등록 상태를 분리해 표시한다.
- `/api/push/register` GET으로 현재 사용자의 활성 토큰 존재 여부를 확인한다.
- 토큰 저장 성공 후 화면 상태를 즉시 갱신한다.
