# PAWU PROJECT STATUS

## 현재 버전
V9.6.3 성능 안정화 패치

## 현재 정상 작동하는 기능
- 보호자/병원 로그인
- 예약 및 예약관리
- 보호자/병원 채팅 송수신
- 앱 내부 알림
- Firebase FCM 기반 앱 종료·잠금화면 푸시 알림
- 보호자 반려동물 관리
- 병원 DB 및 관리자 기능
- 채팅 저장 실패와 푸시 실패가 서로 영향을 주지 않는 예외 분리

## 최근 완료한 작업
- Vercel 운영 환경에 Firebase 환경변수 8개 등록 및 FCM 실제 수신 확인
- 보호자 앱 종료 상태에서 채팅 알림, 소리, 진동 정상 작동 확인
- 채팅방의 5초 전체 재조회 제거
- 채팅 메시지를 Supabase Realtime INSERT 이벤트로 즉시 추가
- 메시지 전송 후 채팅방 전체를 재조회하지 않고 서버가 반환한 새 메시지만 화면에 추가
- 중복 데이터 요청 진행 방지
- 보호자 하단 채팅 배지의 15초 반복 조회 제거
- 병원 채팅 목록의 15초 반복 조회 제거
- 병원 접수·대기 화면의 15초 반복 조회 제거
- 앱이 다시 활성화될 때 필요한 화면만 1회 갱신

## 지금 진행 중인 작업
- V9.6.3 패치를 사용자 PC에 적용하고 모바일 체감 속도 확인
- Supabase Realtime이 운영 프로젝트의 관련 테이블에서 정상 전달되는지 확인

## 발견된 오류와 미해결 문제
- 현재 작업 환경의 npm 사설 저장소에서 `zod-validation-error@4.0.2` 패키지를 찾지 못해 `npm ci` 및 전체 build를 실행하지 못함
- Realtime publication이 `chat_messages`, `chat_conversations`, `notifications`, `hospital_waiting_entries`에 비활성화되어 있으면 실시간 갱신 대신 화면 복귀 시 1회 갱신만 작동함
- 홈·예약·반려동물 등 전체 화면의 데이터 요청 구조는 후속 성능 측정 후 추가 최적화가 필요할 수 있음

## 다음에 진행할 정확한 작업
1. V9.6.3 패치 ZIP을 `C:\Users\USER\pawu-web`에 덮어쓰기
2. `npm run dev`로 보호자·병원 채팅과 접수 화면 확인
3. 보호자와 병원 계정으로 서로 메시지를 보내 Realtime 수신 확인
4. 앱 화면 이동과 복귀 속도 확인
5. 정상 확인 후 Git 커밋·푸시 및 Vercel Production 배포
6. 휴대폰 PWA에서 캐시 갱신 후 체감 속도 재확인
7. 여전히 느린 특정 화면이 있으면 해당 화면별 네트워크 요청을 측정해 2차 최적화

## 마지막으로 수정한 파일 목록
- `components/chat/ConversationRoom.tsx`
- `components/GuardianBottomNav.tsx`
- `app/api/chat/messages/route.ts`
- `app/hospital-admin/chat/page.tsx`
- `app/hospital-admin/reception/page.tsx`
- `PAWU_MASTER.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `README-V9.6.3-PERFORMANCE-PATCH.txt`

## 사용자 테스트가 필요한 항목
- 보호자 채팅방 최초 진입
- 병원→보호자 메시지 즉시 수신
- 보호자→병원 메시지 즉시 수신
- 메시지 전송 시 중복 표시 여부
- 채팅방을 1분 이상 열어도 주기적인 화면 깜박임이나 로딩이 없는지
- 보호자 하단 채팅 배지가 새 메시지에 맞춰 변경되는지
- 채팅방 진입 후 읽음 배지가 정리되는지
- 병원 채팅 목록의 미읽음 수와 마지막 메시지가 갱신되는지
- 병원 접수·대기 화면을 여러 PC에서 변경했을 때 갱신되는지
- 앱 백그라운드 및 종료 상태 FCM 알림이 기존처럼 정상 작동하는지
