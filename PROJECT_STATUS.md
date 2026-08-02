# PAWU PROJECT STATUS

## 현재 버전
V9.6.2 FCM 안정화 패치 준비본

## 현재 정상 작동하는 기능
- 보호자/병원 로그인
- 예약 및 예약관리
- 보호자/병원 채팅 송수신
- 앱 내부 알림
- 보호자 반려동물 관리
- 병원 DB 및 관리자 기능
- 채팅 저장 실패와 푸시 실패가 서로 영향을 주지 않는 예외 분리

## 최근 완료한 작업
- 업로드된 최신 PAWU ZIP과 프로젝트 문서 3종 비교
- 기존 V9.6.1 FCM 코드가 실제 프로젝트에 포함된 것을 확인
- Firebase 서비스 계정 JSON 파싱 안정화
- 데이터 전용 FCM 메시지로 변경하여 중복 시스템 알림 방지
- 동적 Firebase Service Worker에 기존 PWA 오프라인 캐시 기능 병합
- 푸시 설정 화면에서 클라이언트/서버 환경변수 누락을 구분해 표시
- Firebase 환경변수 예제를 `env.local.example`에 추가

## 지금 진행 중인 작업
- 사용자가 `FIREBASE_SERVICE_ACCOUNT_JSON` 값을 `.env.local`과 Vercel에 등록
- Supabase `fcm_tokens` migration 적용 여부 확인
- 실제 Android Chrome/PWA 종료 상태 알림 테스트

## 발견된 오류와 미해결 문제
- 현재 `.env.local`에서 `FIREBASE_SERVICE_ACCOUNT_JSON`이 비어 있어 서버가 FCM을 발송할 수 없음
- Vercel에도 Firebase 환경변수 8개가 모두 등록되어야 운영 배포에서 푸시가 작동함
- `fcm_tokens` migration을 실행하지 않았다면 토큰 등록이 실패함
- 현재 작업 환경의 npm 저장소에서 의존성 일부를 찾지 못해 전체 `npm ci`, build, typecheck를 실행하지 못함
- Android 제조사 절전 정책 또는 Chrome 알림 차단 상태에 따라 알림이 지연될 수 있음

## 다음에 진행할 정확한 작업
1. 이 패치 ZIP을 `C:\Users\USER\pawu-web`에 덮어쓰기
2. 서비스 계정 JSON을 한 줄로 변환해 `.env.local`의 `FIREBASE_SERVICE_ACCOUNT_JSON=` 뒤에 붙여넣기
3. Supabase SQL Editor에서 `supabase/migrations/20260802_pawu_v9_6_1_fcm_tokens.sql` 실행 여부 확인
4. `npm run dev` 후 알림 설정 화면에서 `푸시 알림 연결` 실행
5. 정상 확인 후 Git 커밋·푸시
6. Vercel Environment Variables에 Firebase 8개 값 등록
7. Production 재배포 후 보호자 휴대폰에서 앱 삭제·재설치
8. 앱 종료 및 화면 잠금 상태에서 병원 메시지 발송 테스트

## 마지막으로 수정한 파일 목록
- `lib/push/fcm-admin.ts`
- `app/api/push/config/route.ts`
- `app/firebase-messaging-sw.js/route.ts`
- `app/notifications/settings/page.tsx`
- `env.local.example`
- `PAWU_MASTER.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `README-V9.6.2-FCM-PATCH.txt`

## 사용자 테스트가 필요한 항목
- 알림 설정 화면에서 Firebase 웹 설정/서버 설정 모두 정상 인식되는지
- 푸시 토큰 등록 성공 문구가 표시되는지
- Supabase `fcm_tokens`에 보호자 토큰이 저장되는지
- 보호자 앱 실행 중 채팅 송수신
- 보호자 앱 백그라운드 상태 시스템 알림
- 보호자 앱 완전 종료 및 화면 잠금 상태 시스템 알림
- 알림 소리와 진동
- 같은 메시지 알림이 두 번 표시되지 않는지
- 알림 클릭 시 해당 채팅방으로 이동하는지
- 알림에 실제 메시지 내용이 노출되지 않는지
