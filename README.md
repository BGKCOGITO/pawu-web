# PAWU v1.0.0 RC1

반려동물 보호자 서비스와 동물병원 운영 프로그램을 포함한 PAWU 출시 후보 소스입니다.

## 새 컴퓨터 또는 기존 폴더 교체 후 실행

1. 기존 `pawu-web` 폴더의 `.env.local`을 별도로 보관합니다.
2. 기존 폴더를 종료하거나 이름을 변경합니다.
3. 이 압축을 풀고 폴더명을 `pawu-web`으로 사용합니다.
4. 보관한 `.env.local`을 새 `pawu-web` 최상위 폴더에 복사합니다.
5. 아래 명령을 실행합니다.

```powershell
npm ci
npm run release:check
npm run dev
```

## 필수 주의사항

- `.env.local`은 보안상 압축 파일에 포함하지 않았습니다.
- `node_modules`, `.next`, TypeScript 캐시, 과거 패치 ZIP, 복구 파일은 포함하지 않았습니다.
- Supabase 마이그레이션과 현재 서비스 소스는 유지했습니다.
- 출시 전 점검 문서는 `release/PAWU-V1.0-RC1-RELEASE-CHECKLIST.md`에 있습니다.
- 통합 테스트 시나리오는 `release/PAWU-V1.0-RC1-TEST-SCENARIOS.md`에 있습니다.

## 주요 명령

```powershell
npm run dev
npm run build
npm run typecheck
npm run lint
npm run release:check
```
