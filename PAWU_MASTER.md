# PAWU MASTER

## 1. 프로젝트 목적과 최종 방향
PAWU는 보호자와 동물병원을 연결하는 반려동물 병원 예약·채팅·진료기록·입원경과 공유 플랫폼이다. 초기에는 무료 또는 병행 사용으로 병원 피드백을 확보하고, 안정성과 현장 적합성을 검증한 뒤 플랫폼형 서비스로 확장한다.

## 2. 현재 기술 스택
- Next.js 16 / React 19 / TypeScript 5
- Tailwind CSS 4
- Supabase Auth, PostgreSQL, Storage, Realtime
- Vercel 배포
- PWA(Service Worker)
- Firebase Cloud Messaging(웹 푸시, V9.6.1부터)

## 3. 주요 폴더 구조
- `app/`: 화면과 API Route
- `components/`: 공통 UI 및 보호자/병원 컴포넌트
- `lib/`: 인증, Supabase, 권한, 도메인 로직
- `public/`: PWA 아이콘과 정적 파일
- `supabase/`: SQL 및 migration
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
- `fcm_tokens`: 사용자별 휴대폰 FCM 토큰(V9.6.1)
- 진료기록/처방/입원 관련 테이블은 반려동물 및 예약/병원과 연결

## 5. 확정 기능과 정책
- 보호자 예약, 병원 승인/거절/완료/취소
- 병원 및 보호자 채팅
- 보호자 반려동물 정보와 병원 진료정보 연동
- 병원 DB 10,588건 및 external_id 중복 방지
- 병원 영업/폐업/휴업 상태 관리
- 푸시 알림 내용은 개인정보 보호를 위해 메시지 본문을 노출하지 않고 `병원에서 새 메시지가 도착했습니다.`로 표시

## 6. 변경하면 안 되는 기존 원칙
- 정상 작동 중인 예약·채팅·진료·반려동물 기능을 임의로 재구현하지 않는다.
- 기존 데이터와 예약 데이터는 삭제하지 않는다.
- 병원 DB import 시 external_id 중복을 만들지 않는다.
- 긴 코드 조각보다 변경 파일만 원래 경로대로 담은 패치 ZIP을 우선한다. 전체 기준 확인이 필요한 경우에만 최신 전체 ZIP을 사용한다.
- 기능 변경 전 프로젝트 문서와 실제 코드를 비교한다.

## 7. 개발 및 파일 수정 규칙
- 새 버전마다 `PAWU_MASTER.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`를 갱신한다.
- 마지막 수정 파일 목록과 사용자 테스트 항목을 `PROJECT_STATUS.md`에 기록한다.
- 채팅 한계가 가까우면 추가 작업보다 문서 저장과 ZIP 생성을 우선한다.
- 기존 구현을 바꿀 때는 영향을 명시하고 가능한 최소 범위만 수정한다.

## 8. 배포·환경변수·Supabase 중요사항
- `.env.local`은 교체본 덮어쓰기에서 보존한다.
- Vercel에도 동일한 환경변수를 등록한다.
- Supabase migration은 운영 DB에 한 번만 실행한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용이며 클라이언트에 노출하지 않는다.
- Firebase 서비스 계정 JSON은 `FIREBASE_SERVICE_ACCOUNT_JSON` 서버 환경변수로만 등록한다. 서비스 계정 JSON 파일 자체를 프로젝트나 Git에 포함하지 않는다.
- Firebase 웹 설정 7개는 `.env.local`과 Vercel에 동일하게 등록하며, 운영 푸시는 HTTPS Production에서 최종 확인한다.

## 9. 성능 및 실시간 처리 원칙
- 채팅 메시지 수신은 짧은 주기의 전체 목록 polling보다 Supabase Realtime의 신규 행 이벤트를 우선한다.
- 앱이 백그라운드 또는 종료 상태일 때 알림은 Firebase FCM이 담당하며 브라우저 반복 조회로 대체하지 않는다.
- 동일 API 요청이 진행 중이면 같은 요청을 중복 실행하지 않는다.
- 화면 복귀 시에는 해당 화면에 필요한 데이터만 한 번 동기화한다.
- Realtime 적용 시 기존 채팅 저장 API, 권한 검사, FCM 발송 로직은 임의로 변경하지 않는다.
