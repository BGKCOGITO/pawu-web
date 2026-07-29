# PAWU v1.0.0 RC1 ESLint 기준선

기존 프로젝트에는 장기간 누적된 ESLint 규칙 위반이 다수 존재합니다. 대부분은 `any` 타입, 미사용 변수, React Hook 권고처럼 현재 Production Build와 TypeScript 검사를 통과하는 기존 코드 품질 항목입니다.

RC1 출시 검사는 다음을 차단 기준으로 사용합니다.

- 필수 환경변수 누락
- 정적 보안·구조 검사 실패
- TypeScript 오류
- ESLint 파서/치명적 오류
- Production Build 실패

일반 ESLint 규칙 위반은 숨기지 않고 `release/reports/eslint-baseline.json`에 기록합니다. 정식 출시 이후 기능별로 순차 정리합니다.

개발 중 엄격한 전체 검사는 계속 사용할 수 있습니다.

```powershell
npm run lint
```

출시 기준선 검사는 다음 명령으로 실행됩니다.

```powershell
npm run release:lint
```
