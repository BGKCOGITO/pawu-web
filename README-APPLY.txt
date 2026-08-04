PAWU V13.2.0 병원 Windows 알림 교체본

이번 수정 범위
- 병원 관리자 화면의 전역 Windows 알림만 추가
- 보호자 Android APK, 네이티브 FCM, 채팅 전송, 예약 기능은 변경하지 않음
- PAWU Hospital Tauri 프로그램의 기존 send_pawu_notification 명령을 그대로 사용
- 병원 프로그램 재설치 불필요

추가되는 알림
1. 보호자 → 병원 새 채팅
   - 병원 프로그램에서 어느 메뉴를 보고 있어도 Windows 토스트 알림
   - Windows 기본 알림음
   - 보호자 이름, 반려동물 이름, 메시지 미리보기 표시
   - 현재 열어둔 상세 채팅방은 기존 알림 로직을 사용해 중복 방지
   - 현재 로그인한 병원의 대화만 알림

2. 신규 예약 요청
   - 예약 INSERT 또는 상태가 요청 상태로 전환될 때 알림
   - 보호자 이름, 예약 날짜·시간, 방문 목적/증상 표시
   - 현재 로그인한 병원의 예약만 알림

교체 파일
- components\hospital\HospitalDesktopNotificationBridge.tsx
- components\hospital\HospitalAdminShell.tsx

적용 위치
C:\Users\USER\pawu-web

적용
1. ZIP 압축 해제
2. ZIP의 components 폴더를 C:\Users\USER\pawu-web에 덮어쓰기

검사 및 배포
cd C:\Users\USER\pawu-web

npm run typecheck
npm run build

git add components/hospital/HospitalDesktopNotificationBridge.tsx components/hospital/HospitalAdminShell.tsx
git commit -m "Add hospital Windows chat and reservation alerts"
git push origin main

테스트
1. Vercel 배포가 Ready인지 확인
2. PAWU Hospital 프로그램을 완전히 종료한 뒤 다시 실행
3. 병원 관리자 로그인
4. 대시보드 또는 채팅이 아닌 다른 메뉴를 열어둠
5. 보호자 앱에서 병원으로 새 채팅 전송
6. Windows 우측 하단 알림과 소리 확인
7. 보호자 앱에서 새 예약 요청
8. Windows 예약 알림 확인

Windows에서 알림이 표시되지 않을 때
설정 → 시스템 → 알림 → PAWU Hospital
- 알림 허용
- 알림 배너 표시
- 알림 센터에 표시
- 알림 도착 시 소리 재생
을 모두 켭니다.

주의
- 병원 상세 채팅방을 보고 있을 때는 기존 ConversationRoom의 알림을 사용합니다.
- 이 교체본은 보호자 APK 및 Android 프로젝트를 전혀 수정하지 않습니다.
