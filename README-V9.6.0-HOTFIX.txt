PAWU V9.6.0 CHAT HOTFIX

목적
- V9.6.0 적용 후 채팅방 진입 시 페이지 로드 실패 문제 긴급 복구
- 채팅 관련 변경과 Service Worker 변경을 직전 정상 소스로 되돌림
- 홈 화면 데이터 캐시 최적화는 유지

적용 위치
C:\Users\USER\pawu-web

주의
- .env.local 파일은 삭제하거나 덮어쓰지 마세요.
- 압축 해제 후 전체 파일을 pawu-web 폴더에 덮어씁니다.

PowerShell
cd C:\Users\USER\pawu-web
npm install
npm run dev

로컬 채팅 진입 확인 후:
git add .
git commit -m "PAWU V9.6.0 chat loading hotfix"
git push origin main

배포 후 캐시 정리
1) Chrome에서 F12 > Application > Service Workers > Unregister
2) Clear storage > Clear site data
3) Ctrl+Shift+R
4) 휴대폰 기존 PAWU 앱 삭제 후 Chrome에서 재설치

Vercel 강제 재배포가 필요할 때만:
git commit --allow-empty -m "Force redeploy PAWU V9.6.0 chat hotfix"
git push origin main
