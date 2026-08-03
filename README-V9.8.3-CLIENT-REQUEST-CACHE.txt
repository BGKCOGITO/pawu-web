PAWU V9.8.3 클라이언트 요청 캐시 패치

변경 파일
- lib/client-query-cache.ts (새 파일)
- components/GuardianBottomNav.tsx
- components/home/HomeCareSummary.tsx
- PAWU_MASTER.md
- PROJECT_STATUS.md
- CHANGELOG.md

적용 위치
C:\Users\USER\pawu-web

검사 순서
1. npm run typecheck
2. npm run build
3. npm run dev

확인 항목
- 홈 첫 진입 및 재진입
- 홈 입원 경과와 알림 카드
- 채팅 읽지 않음 배지
- 채팅 읽음 처리 직후 배지 감소
- 새 병원 메시지 수신 직후 배지 증가
- 앱 종료 상태 FCM 알림

배포 명령
git add .
git commit -m "PAWU V9.8.3 client request cache"
git push origin main

새 SQL이나 환경변수는 없습니다.
