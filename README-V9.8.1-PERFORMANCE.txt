PAWU V9.8.1 클라이언트 성능 최적화 패치

[목적]
- 첫 홈 진입에서 중복 Supabase 세션 조회를 줄입니다.
- 홈 재진입 시 계정 역할 확인용 DB 요청을 반복하지 않습니다.
- 저속 네트워크에서 과도한 경로 사전 로딩이 첫 화면을 방해하지 않게 합니다.

[변경 파일]
lib/client-auth-session-cache.ts (새 파일)
components/HomeRoleRedirect.tsx
components/home/HomeCareSummary.tsx
components/guardian/MyHospitalHomeCard.tsx
components/GuardianBottomNav.tsx
components/navigation/RoutePrefetcher.tsx
PAWU_MASTER.md
PROJECT_STATUS.md
CHANGELOG.md

[적용]
ZIP 내부 폴더 구조를 유지해서 C:\Users\USER\pawu-web 에 덮어씁니다.
.env.local, Supabase SQL, Firebase 설정은 변경하지 않습니다.

[검사]
cd C:\Users\USER\pawu-web
npm run typecheck
npm run dev

[배포]
git add .
git commit -m "PAWU V9.8.1 client performance optimization"
git push origin main

[필수 테스트]
1. 보호자 첫 홈 진입과 홈 재진입 속도
2. 병원 관리자 계정의 /hospital-admin/dashboard 자동 이동
3. 슈퍼관리자 계정의 /super-admin/hospitals 자동 이동
4. 홈 돌봄 요약과 자주 가는 병원 표시
5. 채팅 읽지 않음 배지
6. 보호자/병원 채팅 및 앱 종료 푸시
