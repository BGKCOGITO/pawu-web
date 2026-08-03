PAWU V9.9.0 출시 안정성 패치

목적
- 인터넷 연결이 끊겼을 때 앱이 멈춘 것처럼 보이지 않도록 상태 안내
- 화면 단위 오류 발생 시 다시 시도 및 홈 이동 제공
- 존재하지 않는 주소 접근 시 PAWU 전용 404 화면 제공
- 기존 채팅, FCM 푸시, 예약, Supabase 구조는 변경하지 않음

변경 파일
- components/system/NetworkStatusBanner.tsx (신규)
- components/AppShell.tsx
- app/error.tsx (신규)
- app/global-error.tsx (신규)
- app/not-found.tsx (신규)
- app/globals.css
- PAWU_MASTER.md
- PROJECT_STATUS.md
- CHANGELOG.md

검사 순서
1. npm run typecheck
2. npm run build
3. npm run dev
4. 비행기 모드 ON/OFF 시 연결 배너 확인
5. 존재하지 않는 주소 /this-page-does-not-exist 확인
6. 채팅·예약·푸시 정상 확인
