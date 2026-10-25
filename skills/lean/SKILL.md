---
name: lean
description: lean — review(고친 것·변경을 봐 달라, 리뷰, 문제 있나), repo(저장소 전체 감사), debt(임시방편·shortcut 목록), commit(커밋 메시지), rename(여러 파일 이름 바꾸기), audit(고정 컨텍스트 점검), stats(세션 토큰·lean 절감), on·off(lean 켜기·끄기), help. 이런 요청이면 먼저 부른다.
argument-hint: "[help|review|repo|debt|commit|rename|audit|stats|on|off]"
---

lean 은 이 스킬 하나와 하네스(훅)로 돈다. 훅은 규칙(`rules.md`)을 넣고, 긴 성공 로그를 줄이고, `.contextignore` 를 지키고, 압축 뒤 고친 파일 목록을 되살린다. 이 스킬은 인자(또는 사용자 요청)에 맞는 갈래 하나만 한다. 갈래의 자세한 절차는 이 스킬 폴더의 파일에 있다. 그 갈래를 할 때만 그 파일을 읽고 그대로 따른다.

| 갈래 | 할 일 |
|---|---|
| `review` | `review.md` 를 읽고 따른다. 변경 검토: 버그·보안·부하·테스트·속도·불필요한 줄. |
| `repo` | `repo.md` 를 읽고 따른다. 저장소(또는 사용자가 정한 폴더) 전체 감사. |
| `debt` | `debt.md` 를 읽고 따른다. `shortcut:` 주석 장부. |
| `commit` | `commit.md` 를 읽고 따른다. 커밋 메시지만 쓰고 커밋은 하지 않는다. |
| `rename` | `rename.md` 를 읽고 따른다. 여러 파일에서 이름 바꾸기. |
| `audit` | 아래 "audit". |
| `stats` | 아래 "stats". |
| `on` · `off` | Bash 로 `node "<이 스킬 폴더>/../../hooks/lean.mjs" set off`(켜기는 `set on`)를 돌리고, 나온 `[lean]` 줄대로 따른 뒤 한 줄로 알린다. |
| 인자 없음 · `help` | 아래 카드를 보여 준다. |

## audit

1. `node "<이 스킬 폴더>/audit.mjs" "<작업 폴더>"` 를 돌린다. 읽기만 한다.
2. 한국어로 보고한다: 합계와 종류별 비중 → 큰 항목마다 "무엇이 매번 실리는지 → 줄이면 얼마나(추정) → 방법(`disable-model-invocation: true`, 설명 다듬기, 안 쓰는 플러그인 끄기)" → 이름이 겹치는 스킬, 매번 글을 넣는 플러그인 훅, 하위 폴더 스킬 → 못 잰 것(MCP·커넥터 도구 설명, 내장 프롬프트. 정확한 값은 `/context`, 플러그인 하나는 `claude plugin details <이름>`).
3. 파일은 고치지 않는다. 사용자가 고르면 그때 고친다. 메모리 파일은 사용자의 메모리 정책을 따른다.

완료 기준: 큰 상위 항목마다 제안이 하나씩 있고, 못 잰 것이 적혀 있다.

## stats

`node "<이 스킬 폴더>/stats.mjs" "<작업 폴더>"` 를 돌린다(기록 파일을 직접 주려면 `.jsonl` 경로). 표를 보여 주고 눈에 띄는 것 두세 개를 짚는다: 줄일 수 있었던 큰 도구 결과, 반복해서 읽은 파일, lean 이 못 줄인 긴 로그를 내는 자주 쓴 명령, lean 이 줄인 양.

## 카드

```
lean
  /lean review   변경 검토          /lean repo    저장소 전체 감사
  /lean debt     shortcut: 장부      /lean commit  커밋 메시지
  /lean rename 옛이름 새이름  여러 파일 이름 바꾸기
  /lean audit    매 세션 고정 컨텍스트 점검
  /lean stats    이번 세션 토큰·큰 출력·반복 읽기·lean 절감
  /lean off · /lean on   이 세션에서 lean 끄기·켜기(압축 뒤에도 유지)
자동
  규칙 주입(말·코드·읽기), 서브에이전트엔 코드·읽기만
  설치·빌드·테스트의 긴 성공 로그 줄이기: [lean] 줄에 전체 경로. 한 번만 전체: 명령에 LEAN_FULL
  진행률 줄 정리, 같은 줄 반복 묶기, 큰 JSON 배열은 내용 그대로 표로
  .contextignore 에 적힌 파일은 읽지 않음
  압축 뒤 고친 파일 목록 되살림
```
