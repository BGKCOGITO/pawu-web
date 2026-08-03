# PAWU V10.0.0 RC 출시 체크리스트

## 목적
이 문서는 기능을 다시 설계하는 QA 문서가 아니라, 이미 정상 확인된 PAWU를 베타 배포하기 직전의 운영·배포 확인용 문서다.

## 1. 로컬 검증
- [ ] `.env.local`이 존재하며 Git에 포함되지 않는다.
- [ ] `npm run release:ready` 통과
- [ ] `npm run typecheck` 통과
- [ ] `npm run build` 통과
- [ ] 보호자↔병원 채팅 정상
- [ ] 앱 종료·백그라운드 상태 FCM 소리·진동 정상
- [ ] 예약 조회와 병원 예약관리 정상
- [ ] 병원 찾기·검색·지도 정상

## 2. Supabase 운영 확인
- [ ] `fcm_tokens`에 활성 보호자 토큰 존재
- [ ] `push_jobs`가 `pending → processing → sent`로 처리
- [ ] `process-push-jobs` Edge Function ACTIVE
- [ ] push_jobs INSERT Webhook 정상
- [ ] 1분 재시도 Cron 정상
- [ ] Firebase 서비스 계정, `PUSH_WORKER_SECRET`, `PAWU_PUBLIC_URL` Function Secret 유지

## 3. Vercel 운영 확인
- [ ] Production 환경변수의 Supabase/Firebase/Solapi 값 유지
- [ ] Production 배포가 Ready
- [ ] 운영 주소 `https://pawu-web.vercel.app` 접속 정상
- [ ] `/notifications/settings` 접속 및 토큰 등록 상태 정상
- [ ] 새 배포 후 기존 PWA와 재설치 PWA 모두 확인

## 4. 베타 배포 원칙
- [ ] 초기 병원은 소수로 시작
- [ ] 정상 기능을 임의로 재구현하지 않음
- [ ] 치명적 오류 외 기능 추가는 베타 피드백 이후 진행
- [ ] 장애 발생 시 마지막 정상 Git 커밋으로 즉시 롤백
- [ ] DB migration은 되돌리기 전에 데이터 보존 여부를 먼저 확인

## 5. 배포 명령
```powershell
cd C:\Users\USER\pawu-web
npm run release:ready
npm run typecheck
npm run build
git add .
git commit -m "PAWU V10.0.0 RC1 release candidate"
git push origin main
```

## 6. 롤백 기준
다음 중 하나가 발생하면 신규 기능 추가 없이 즉시 롤백을 우선한다.
- 로그인 불가
- 예약 저장 또는 조회 불가
- 채팅 저장 불가
- 병원→보호자 푸시 전체 실패
- 주요 화면 반복 500 오류

롤백은 Vercel의 직전 정상 Production 배포 Promote 또는 Git revert를 사용한다.
