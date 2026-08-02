PAWU V9.6.0 성능 안정화 교체본 적용 안내

[중요]
- 이 ZIP은 최신 PC 프로젝트 app(10).zip을 기준으로 만든 전체 교체본입니다.
- .env.local은 포함하지 않았습니다. 기존 C:\Users\USER\pawu-web\.env.local은 삭제하지 마세요.
- 이번 버전에는 FCM 푸시 알림이 포함되지 않습니다. FCM은 V9.6.1에서 별도로 진행합니다.

1. 기존 프로젝트 백업
PowerShell:

cd C:\Users\USER
Copy-Item -Path .\pawu-web -Destination .\pawu-web-backup-v9.5 -Recurse

2. ZIP 압축 해제 및 덮어쓰기
- PAWU-V9.6.0-performance-rebuilt.zip의 모든 파일을 아래 폴더에 덮어씁니다.

C:\Users\USER\pawu-web

- 기존 .env.local은 그대로 유지합니다.

3. 프로젝트 폴더 이동

cd C:\Users\USER\pawu-web

4. 패키지 설치

npm install

5. 로컬 실행

npm run dev

브라우저에서 아래 주소를 확인합니다.
http://localhost:3000

확인 항목
- 보호자 로그인
- 병원 로그인
- 보호자 앱 채팅 목록과 채팅방
- 병원 관리자 채팅 목록과 채팅방
- 메시지 송수신 속도
- 예약 조회 및 예약 관리
- 반려동물 목록과 상세 화면
- 홈 화면 이동 및 뒤로 가기 속도

6. 로컬 확인 후 Git 반영

cd C:\Users\USER\pawu-web
git add .
git commit -m "PAWU V9.6.0 performance stabilization"
git push origin main

7. Vercel 배포 확인
- Vercel의 Production 배포가 Ready가 될 때까지 기다립니다.
- Chrome에서 실제 운영 주소를 먼저 확인합니다.

8. 브라우저 및 PWA 캐시 갱신
Chrome에서 운영 주소를 연 뒤:

Ctrl + Shift + R

그래도 이전 화면이면:
- F12
- Application
- Service Workers
- Unregister
- Storage 또는 Clear storage에서 사이트 데이터 삭제
- 페이지 새로고침

정상 화면이 확인되면 기존 PAWU PWA를 삭제하고 홈 화면에 다시 설치합니다.

9. Vercel이 새 커밋을 배포하지 않을 때만 강제 재배포

cd C:\Users\USER\pawu-web
git commit --allow-empty -m "Force clean production redeploy for V9.6.0"
git push origin main

Vercel Production이 Ready가 된 후 다시 접속합니다.

[V9.6.0 변경 사항]
- 채팅방의 5초 전체 메시지 반복 조회 제거
- Supabase Realtime으로 새 메시지만 반영
- 메시지 전송 후 전체 채팅방 재조회 제거
- 읽음 처리와 채팅 데이터 조회 분리
- 화면 복귀 시 한 번만 안전 동기화
- 하단 채팅 배지의 15초 반복 조회 제거
- 채팅 INSERT/UPDATE 이벤트 시 배지 갱신
- 홈 돌봄 요약 데이터 60초 세션 캐시
- Service Worker 캐시 V9.6.0으로 갱신
- 이전 Service Worker 캐시 자동 삭제

[검증 안내]
- ZIP 구조 및 압축 무결성 검사는 완료했습니다.
- 이 작업 환경의 npm 저장소에서 zod-validation-error@4.0.2를 찾지 못해 npm ci와 전체 build는 완료하지 못했습니다.
- 사용자 PC에서는 위 순서대로 npm install 후 npm run dev로 반드시 확인하고 Git에 반영하세요.
