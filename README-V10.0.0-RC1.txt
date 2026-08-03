PAWU V10.0.0 RC1 출시 후보 패치

[변경 파일]
package.json
package-lock.json
app/manifest.ts
scripts/release-readiness.mjs
RELEASE-CHECKLIST-V10-RC.md
PAWU_MASTER.md
PROJECT_STATUS.md
CHANGELOG.md
README-V10.0.0-RC1.txt

[적용 위치]
C:\Users\USER\pawu-web

[검사 순서]
cd C:\Users\USER\pawu-web
npm run release:ready
npm run typecheck
npm run build

[배포]
git add .
git commit -m "PAWU V10.0.0 RC1 release candidate"
git push origin main

새로운 Supabase SQL이나 환경변수는 없습니다. 기존 .env.local과 Vercel/Supabase secrets를 유지하세요.
