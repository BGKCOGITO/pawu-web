# PAWU MASTER

## 1. 프로젝트 목적과 최종 방향
PAWU는 보호자와 동물병원을 연결하는 반려동물 병원 예약·채팅·진료기록·입원경과 공유 플랫폼이다. 초기에는 무료 또는 병행 사용으로 병원 피드백을 확보하고, 안정성과 현장 적합성을 검증한 뒤 플랫폼형 서비스로 확장한다.

## 2. 현재 기술 스택
- Next.js 16 / React 19 / TypeScript 5
- Tailwind CSS 4
- Supabase Auth, PostgreSQL, Storage, Realtime, Edge Functions
- Vercel 배포
- PWA(Service Worker)
- Firebase Cloud Messaging(웹 푸시)

## 3. 주요 폴더 구조
- `app/`: 화면과 API Route
- `components/`: 공통 UI 및 보호자/병원 컴포넌트
- `lib/`: 인증, Supabase, 권한, 도메인 로직
- `public/`: PWA 아이콘과 정적 파일
- `supabase/migrations/`: 운영 DB 변경 SQL
- `supabase/functions/`: Supabase Edge Functions
- `scripts/`: 데이터 import, 배포 검증 스크립트

## 4. 주요 데이터베이스 관계
- `profiles`/Auth user: 보호자 및 사용자 계정
- `hospitals`: 병원 기본정보
- `pets`: 보호자 반려동물
- `reservations`: 병원-보호자-반려동물 예약
- `chat_conversations`: 병원과 보호자의 채팅방
- `chat_messages`: 채팅 메시지
- `notifications`: 앱 내부 알림
- `notification_preferences`: 사용자별 알림 설정
- `fcm_tokens`: 사용자별 휴대폰 FCM 토큰
- `push_jobs`: FCM 비동기 발송 작업, 재시도 및 결과 로그(V9.7.0)
- 진료기록/처방/입원 관련 테이블은 반려동물 및 예약/병원과 연결

## 5. 확정 기능과 정책
- 보호자 예약, 병원 승인/거절/완료/취소
- 병원 및 보호자 채팅
- 보호자 반려동물 정보와 병원 진료정보 연동
- 병원 DB 10,588건 및 `external_id` 중복 방지
- 병원 영업/폐업/휴업 상태 관리
- 푸시 알림에는 메시지 본문을 노출하지 않고 `병원에서 새 메시지가 도착했습니다.`만 표시
- 병원 발신 채팅 푸시는 채팅 API가 직접 보내지 않고 DB 작업 큐와 Supabase Edge Function이 처리
- 푸시 실패는 채팅 저장 성공 여부에 영향을 주지 않으며, 작업 큐에서 최대 5회 재시도

## 6. 변경하면 안 되는 기존 원칙
- 정상 작동 중인 예약·채팅·진료·반려동물 기능을 임의로 재구현하지 않는다.
- 기존 데이터와 예약 데이터를 삭제하지 않는다.
- 병원 DB import 시 `external_id` 중복을 만들지 않는다.
- 긴 코드 조각보다 변경 파일만 원래 경로대로 담은 패치 ZIP을 우선한다.
- 기능 변경 전 프로젝트 문서와 실제 코드를 비교한다.
- 채팅 화면 성능 최적화와 FCM 시스템 푸시는 서로 독립적으로 유지한다.

## 7. 개발 및 파일 수정 규칙
- 새 버전마다 `PAWU_MASTER.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`를 갱신한다.
- 마지막 수정 파일 목록과 사용자 테스트 항목을 `PROJECT_STATUS.md`에 기록한다.
- 채팅 한계가 가까우면 추가 작업보다 문서 저장과 ZIP 생성을 우선한다.
- 기존 구현을 바꿀 때는 영향을 명시하고 가능한 최소 범위만 수정한다.
- 운영 DB migration은 재실행 가능하도록 `if not exists`, `on conflict` 등을 사용한다.

## 8. 배포·환경변수·Supabase 중요사항
- `.env.local`은 교체본 덮어쓰기에서 보존한다.
- Vercel에는 Firebase 웹 환경변수와 서비스 계정 환경변수를 유지한다.
- V9.7.0부터 FCM 서버 발송용 `FIREBASE_SERVICE_ACCOUNT_JSON`은 Supabase Edge Function secret에도 등록한다.
- Edge Function에는 `PUSH_WORKER_SECRET`와 `PAWU_PUBLIC_URL`을 secret으로 등록한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버/Edge Function 전용이며 브라우저에 노출하지 않는다.
- `push_jobs` INSERT Database Webhook과 1분 간격 retry 호출을 반드시 설정한다.
- Firebase 서비스 계정 JSON 파일 자체를 프로젝트나 Git에 포함하지 않는다.


## V9.7.1 푸시 토큰 등록 진단
- 알림 권한과 FCM 토큰 DB 등록 상태를 분리해 표시한다.
- `/api/push/register` GET으로 현재 사용자의 활성 토큰 존재 여부를 확인한다.
- 토큰 저장 성공 후 화면 상태를 즉시 갱신한다.

## V9.7.2 푸시 운영 안정화 원칙
- 푸시 발송은 DB 큐와 Edge Function으로 처리한다.
- 5분 이상 processing 상태인 작업은 자동 복구한다.
- retry 작업은 1분 주기 worker 호출로 다시 처리한다.
- sent/skipped는 30일, dead는 90일 보관 후 정리한다.
- 관리자 운영센터에서 활성 토큰, 성공·실패·멈춤 작업을 확인하고 재시도할 수 있다.
