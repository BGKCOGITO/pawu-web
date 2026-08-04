PAWU V13.0.1 푸시 시스템 빌드 오류 수정 교체본

수정한 오류
components/push/PushNotificationManager.tsx:153
Type 'Unsubscribe' is not assignable to type '() => undefined'.

수정 내용
- removeForeground 타입을 (() => void) | undefined 로 변경
- cleanup 시 removeForeground?.()로 안전하게 호출
- Firebase onMessage가 반환하는 Unsubscribe 타입과 일치

검증
- 수정 파일에 대한 TypeScript 정적 타입 검증 통과
- 사용자에게 발생한 TS2322 오류 재현 지점을 제거함
- 이 실행 환경의 npm 패키지 레지스트리에서 일부 패키지를 제공하지 않아 전체 npm install/next build는 여기서 실행하지 못함
- 사용자 PC에서는 아래 명령으로 전체 빌드를 최종 확인해야 함

적용 위치
C:\Users\USER\pawu-web

적용 순서
1. ZIP 압축 해제
2. 전체 내용을 C:\Users\USER\pawu-web에 폴더 구조 그대로 덮어쓰기
3. 아래 명령 실행

cd C:\Users\USER\pawu-web
npm install
npm run typecheck
npm run build

정상 통과 후 배포
git add .
git commit -m "Fix PAWU V13 push build types"
git push origin main

PAWU V13.0.0 보호자 푸시 시스템 전면 재구축

이 교체본은 기존 푸시 코드 위에 패치를 덧붙이는 방식이 아니라,
최신 PAWU 프로젝트를 기준으로 보호자 푸시 등록 흐름을 다시 구성한 버전입니다.

핵심 변경
1. Firebase CDN script 주입 제거
2. firebase npm SDK 10.14.1 사용
3. 서비스 워커 /firebase-messaging-sw.js 하나로 통일
4. 기존 public/sw.js 또는 다른 등록 worker 자동 해제
5. 권한→설정→서비스 워커→Firebase→토큰→DB 저장 단계 표시
6. FCM getToken 25초 타임아웃
7. 성공하면 안내창 자동 닫힘
8. 실패하면 멈춘 단계와 실제 오류 문구 표시
9. 토큰 초기화 후 재연결 버튼 제공
10. 서버 notification + data payload로 앱 종료 상태 알림 지원

교체 파일
- package.json
- app/layout.tsx
- app/firebase-messaging-sw.js/route.ts
- app/api/push/config/route.ts
- app/api/push/register/route.ts
- app/api/chat/messages/route.ts
- app/notifications/settings/page.tsx
- components/PwaBridge.tsx
- components/push/PushNotificationManager.tsx
- components/push/AutoPushRegistration.tsx
- lib/push/client.ts
- lib/push/fcm-admin.ts
- PAWU_MASTER.md
- PROJECT_STATUS.md
- CHANGELOG.md

적용 위치
C:\Users\USER\pawu-web

적용 순서
1. PAWU 프로젝트 백업
2. ZIP 압축 해제
3. ZIP의 app, components, lib, package.json 및 문서 파일을
   C:\Users\USER\pawu-web에 폴더 구조 그대로 덮어쓰기

4. 설치 및 검사
cd C:\Users\USER\pawu-web
npm install
npm run typecheck
npm run build

5. 배포
git add .
git commit -m "Rebuild PAWU push notification system V13"
git push origin main

6. Vercel 배포 Ready 확인

휴대폰 초기화
1. Supabase fcm_tokens 기존 행 삭제
2. 휴대폰 설정 → 앱 → PAWU → 저장공간 → 데이터 삭제
3. Chrome 설정 → 사이트 설정 → 알림에서 pawu-web.vercel.app 허용 확인
4. PAWU 앱 실행 및 보호자 로그인
5. 알림 허용 및 연결 버튼 누르기

정상 진행 화면
- 권한 확인
- Firebase 설정
- 백그라운드 서비스
- Firebase 초기화
- 토큰 발급
- 서버 저장
- 완료

정상 결과
- 안내창 자동 닫힘
- Supabase fcm_tokens 새 행 생성
- is_active = true
- 앱 종료 후 병원 메시지 알림 수신

멈추는 경우
안내창에 현재 단계와 실제 오류가 표시됩니다.
이제 USB 디버깅 없이도 오류 위치를 화면에서 바로 확인할 수 있습니다.

중요
npm install을 반드시 먼저 실행해야 합니다.
이번 버전은 firebase 10.14.1 패키지를 새로 추가합니다.
