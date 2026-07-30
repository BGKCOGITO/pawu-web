PAWU V9.0.7 현재 위치 핀 표시 패치

변경 내용
- 내 위치 버튼 클릭 시 파란 현재 위치 점 표시
- 위치 정확도 반경을 반투명 원으로 표시
- 위치가 갱신될 때 핀과 반경 자동 이동
- 지도 상단에 현재 위치 범례 표시
- 위치 오류 안내 문구 개선

적용 방법
1. ZIP 안의 app 폴더를 C:\Users\USER\pawu-web 에 덮어쓰기
2. PowerShell 실행
   cd C:\Users\USER\pawu-web
   git add .
   git commit -m "Add PAWU current location marker"
   git push origin main
3. Vercel 배포 Ready 확인 후 앱 완전 종료 후 재실행
