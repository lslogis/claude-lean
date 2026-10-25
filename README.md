# lean

Claude Code 를 가볍게, 그러면서 대화와 작업을 방해하지 않게 쓰는 플러그인. **스킬 하나(`/lean`) + 하네스 하나(훅)** 로 돈다.

토큰 절약 도구 7개(ponytail, caveman, rtk, headroom, context-mode, serena, token-optimizer)를 분석해, 오류 없이 돌고 대화를 깎지 않는 장점만 담았다. 프록시·MCP 서버·바이너리·대시보드는 없다. 설정 파일을 고치지 않고, 아무것도 밖으로 보내지 않는다.

## 설치

```
/plugin marketplace add lslogis/claude-lean
/plugin install lean@lean
```

터미널에서는 `claude plugin marketplace add lslogis/claude-lean` 다음 `claude plugin install lean@lean`. Node.js 가 PATH 에 있어야 한다. Windows 11 · Claude Code 2.1.310 에서 시험했다.

## 쓰기

말로 부탁해도 되고(“방금 고친 거 봐줘”, “lean 꺼줘”) 명령으로 불러도 된다.

| 명령 | 하는 일 |
|---|---|
| `/lean review` | 변경 검토: 버그·보안·부하·테스트·속도·불필요한 줄 |
| `/lean repo` | 저장소(또는 폴더) 전체 감사 |
| `/lean debt` | `shortcut:` 주석 장부 |
| `/lean commit` | 커밋 메시지(커밋은 하지 않음) |
| `/lean rename 옛이름 새이름` | 여러 파일에서 이름 바꾸기(LSP → 검색 → Edit → 확인) |
| `/lean audit` | 매 세션 고정으로 실리는 컨텍스트 점검 |
| `/lean stats` | 이번 세션 토큰·큰 출력·반복 읽기·lean 이 줄인 양 |
| `/lean off` · `/lean on` | 이 세션에서 lean 끄기·켜기(압축 뒤에도 유지) |
| `/lean help` | 카드 |

## 자동으로 하는 일

- **규칙** (`rules.md`, 약 610토큰): 세션마다 말·코드·읽기 규칙을 넣는다. 서브에이전트에는 코드·읽기만.
- **긴 성공 로그**: 설치·빌드·테스트 명령이 성공했을 때 색상 코드를 지우고, 진행률·반복 줄을 묶고, 앞 30줄·뒤 50줄·오류/경고 줄만 남긴다. 원문은 `~/.claude/lean/out` 에 3일 둔다(명령에 든 `VAR=값`·URL 비밀번호·`--token` 값은 가린다. 출력에 찍힌 비밀값은 그대로 남는다). 실패했거나 출력에 오류 표시가 있으면 건드리지 않는다. 한 번만 전체를 보려면 명령에 `LEAN_FULL`.
- **큰 JSON 배열**: 키가 같은 객체 목록은 내용 그대로 열 이름 + 값 줄로 바꾼다.
- **`.contextignore`**: 작업 폴더(와 그 위)에 있으면 적힌 패턴의 파일은 Read 를 막는다.
- **압축 뒤 복원**: 압축 직전에 고친 파일 10개를 참고 데이터로 다시 넣는다.

## 알아 둘 것

- Read·Bash·PowerShell 호출마다 node 가 한 번 뜬다(각 약 0.1초).
- 줄인 로그에서 오류·경고 낱말이 없는 중간 줄과 진행률 중간값은 빠진다. 전체는 `[lean]` 줄의 경로에 있다.
- 훅이 실패하면 아무것도 바꾸지 않은 것과 같다(항상 exit 0, 오류는 `~/.claude/lean/hook-error.log`).
- `.contextignore` 는 실수로 큰·민감한 파일을 읽지 않게 하는 장치이지 보안 경계가 아니다. Read 만 막고, Bash 의 `cat`·Grep 은 막지 않는다.
- 상태·로그는 사용자 홈의 `~/.claude/lean` 에만 쓴다(폴더 0700, 파일 0600).
- 두 마켓플레이스에서 겹쳐 설치돼 훅이 두 번 돌아도, 같은 사건(세션 시작·도구 결과·서브에이전트)은 한쪽만 처리한다. 겹친 설치는 `/lean audit` 의 "이름이 겹치는 스킬"에 나온다. 하나만 남기는 게 좋다.

## 출처와 라이선스

lean 은 MIT. `skills/lean/review.md`·`repo.md`·`debt.md` 는 [ponytail](https://github.com/DietrichGebert/ponytail) 5.3.2(MIT), `commit.md` 는 [caveman](https://github.com/JuliusBrussee/caveman) 4.0.1(Apache-2.0)을 고쳐 쓴 것이다. 원문 라이선스는 `licenses/`. 나머지 도구(rtk, headroom, context-mode, serena, token-optimizer)에서는 코드가 아니라 아이디어만 가져와 새로 썼다.
