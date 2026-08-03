PAWU 보호자/병원 로그인 완전 분리 교체본

적용 대상:
C:\Users\USER\pawu-web

변경:
- 보호자 로그인: /auth/login
  보호자 로그인과 보호자 간편 로그인만 표시
- 병원 로그인: /auth/hospital-login
  병원 관리자 로그인과 병원 회원가입만 표시
- /hospital-admin 진입 시 병원 전용 로그인으로 이동
- 보호자 앱에서 병원/최고관리자 계정 로그인 차단
- 병원 프로그램에서 보호자 계정 로그인 차단
- 로그인 성공 후 병원 대시보드로 이동

적용:
1. ZIP 압축 해제
2. app, components 폴더를 아래에 덮어쓰기
   C:\Users\USER\pawu-web

검사:
cd C:\Users\USER\pawu-web
npm run typecheck
npm run build
npm run dev

확인:
보호자: http://localhost:3000/auth/login
병원: http://localhost:3000/auth/hospital-login
병원 프로그램 진입: http://localhost:3000/hospital-admin

배포:
git add .
git commit -m "Separate guardian and hospital login"
git push origin main
