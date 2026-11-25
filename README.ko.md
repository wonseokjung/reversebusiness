<p align="center">
  <b>CONNECT AI LAB · 모두를 위한 AI 교육</b><br>
  <a href="https://www.youtube.com/@CONNECT-AI-LAB">유튜브 CONNECT AI LAB</a> · <a href="https://www.aicitybuilders.com">강의 aicitybuilders.com</a>
</p>

<p align="center">
  <a href="README.md">English</a> | <b>한국어 (Korean)</b>
</p>

# reversebusiness

![해부 장면: 페이지의 구역이 뼈대로 나타나 층으로 벌어지고, 돈이 흐르는 길과 내 버전이 이어진다](docs/hero.gif)

**사업 웹사이트 주소 하나를 넣으면 그 사업을 해부합니다.** 누가 왜 돈을 내는지, 어디서 들어와 어디서 결제하는지, 페이지가 어떤 층으로 짜여 있는지를 확인된 만큼만 정리하고, 구조만 배워 내 버전을 새로 만듭니다. 원본의 문구, 이름, 이미지, 코드는 복제하지 않습니다.

```bash
npx github:wonseokjung/reversebusiness
```

**한 줄이면 `reversebusiness` 스킬이 설치되고, 원하시면 확인을 거쳐 공식 [REA](https://github.com/morluto/rea) 도 함께 연결됩니다.** 의존성 0개, Node 18 이상 (`macOS · Windows · Linux` 지원, REA 정밀 모드는 Node `22.19+`, `24.11+`, `26+`).

<p align="center">
  <img src="skill/reversebusiness/assets/mascot/greet.gif" width="68" alt="포도청 다모 사업 분석가 · 인사">&nbsp;
  <img src="skill/reversebusiness/assets/mascot/collect.gif" width="68" alt="포도청 다모 사업 분석가 · 수집">&nbsp;
  <img src="skill/reversebusiness/assets/mascot/dissect.gif" width="68" alt="포도청 다모 사업 분석가 · 해부">&nbsp;
  <img src="skill/reversebusiness/assets/mascot/done.gif" width="68" alt="포도청 다모 사업 분석가 · 완료"><br>
  <sub><b>포도청 다모 · 사업 분석가</b> (CONNECT AI HQ PixelCrew) — 대화할 때 인사·근거 수집·6칸 해부·완성 상태에 맞춰 작게 움직이며 표정이 바뀌는 픽셀 캐릭터예요.</sub>
</p>

## 30초 시작하기

1. 터미널에 위 명령을 실행합니다. 컴퓨터에 설치된 코딩 에이전트(`Claude Code`, `Codex`, `Gemini CLI`, `Cursor`, `Antigravity`)를 찾아 바뀔 폴더를 먼저 보여 준 뒤 확인을 거쳐 설치합니다. `REA` 가 없으면 설치할 내용(`rea-agents`)을 보여 주고 한 번 더 확인합니다(`--no-rea` 로 생략, `--yes` 로 자동 동의).
2. 설치가 끝나면 브라우저에 예시 해부 화면이 열립니다.
3. 에이전트를 열고 이렇게 말합니다:

   ```text
   reversebusiness 로 <궁금한 사업의 주소> 를 해부해 줘
   ```

터미널에서 주소 하나만 바로 넘겨 **원스탑으로 끝까지** 실행할 수도 있습니다:

```bash
npx github:wonseokjung/reversebusiness https://example.com --agent claude --yes
```

- **실시간 Chrome 창 보기:** macOS · Windows 데스크톱에서는 임시 프로필 Chrome 창이 화면에 직접 떠서 구역을 훑고 가격 탭·FAQ 를 누르는 모습을 실시간으로 보여 줍니다 (`--headless` 로 숨기기 가능, `--no-render` 는 HTML 만 읽기).
- **원스탑 자동 완성:** `--agent claude` 나 `--agent codex` 를 주거나 대화형 터미널에서 `[Y/n]` 에 답하면 수집 직후 1~6번 칸 완성 + 내 버전 출발점(`my-version/`) + 겹침 검사 + 완성된 `report.html` 까지 한 번에 열립니다 (`--no-fill` 은 초안만 확인).
- **다국어 지원:** OS 언어에 맞춰 영어/한국어가 자동 선택되며 `--lang en` 또는 `--lang ko` 로 강제 지정할 수 있습니다.

| 옵션 | 하는 일 |
|---|---|
| `--yes`, `-y` | 확인 질문 없이 설치·실행 진행 |
| `--dry-run` | 아무것도 내려받거나 바꾸지 않고 계획만 미리 보기 |
| `--lang ko \| en` | 터미널 출력 및 해부 화면 언어 고르기 |
| `--headless` | Chrome 창을 화면에 띄우지 않고 백그라운드 실행 |
| `--agent <이름>` | 설치 대상(`claude,codex,cursor,gemini,antigravity,agents`) 또는 실행 에이전트(`claude` / `codex`) 지정 |
| `--no-rea` | REA 설치 제안을 건너뛰고 자체 수집기로 진행 |
| `--no-fill` | 수집 초안만 만들고 에이전트 자동 완성은 건너뛰기 |
| `--topic "<주제>"` | 내 버전 명세(6번 칸)와 출발점 사이트의 사업 주제 지정 |
| `--own` | 내 사이트로 지정 (정적 코드 흔적 점검 허용) |
| `--remove` | `reversebusiness` 가 설치한 스킬만 삭제 (REA 는 건드리지 않음) |

## 네 단계

| 단계 | 하는 일 | 결과물 |
|---|---|---|
| 1. 읽기 | `robots.txt` 와 약관을 확인하고 공개 페이지 최대 5장에서 근거를 모은다 | `source.json`, `requests.json`, `evidence/` |
| 2. 해부 | 정해진 6칸(`돈 · 흐름 · 화면 지도 · 기술 · 근거와 모르는 것 · 내 버전 명세`)을 채우고 `관찰/추정/코드 흔적/모름`을 붙인다 | `report.json`, 단일 HTML `report.html` |
| 3. 내 버전 만들기 | 6번 칸 명세와 배운 구역 순서만으로 중립적인 새 사이트 출발점을 생성한다 | `my-version/` (`index.html`, `style.css`) |
| 4. 검사 | 5단어 이상 연속 복사 문장, 원본 브랜드명/도메인/이미지 URL 겹침이 없는지 검사한다 | 겹침 검사 통과 여부 |

## 세 깊이로 읽기 (REA 연동 시)

[REA (`rea-agents`)](https://github.com/morluto/rea)가 있으면 같은 임시 브라우저에 붙어 정밀 모드로 읽습니다:

| 깊이 | 무엇을 하나 | 얻는 것 | 하지 않는 것 |
|---|---|---|---|
| 1. 겉 읽기 | 그려진 화면의 글, 구역 높이, 단추, 저장소 키 이름 수집 | 실제 가격, 구역 뼈대 | 쿠키·저장소 값은 읽지 않음 |
| 2. 흐름 읽기 | 가격 탭·FAQ·"더 보기"만 누르고 요청 호스트 수집 | 탭 안의 가격, 결제사·분석 도구 | 로그인/결제/폼 제출 클릭 없음, 본문·토큰 미저장 |
| 3. 속 읽기 | 이미 내려온 스크립트를 정적 스캔 (약관 금지 시 건너뜀, `--own` 은 허용) | 화면 경로 이름, 결제 모듈 단서 | 찾은 주소 직접 호출 없음, `observed` 승격 금지 |

## 해부 이후 명령어

```bash
rebiz <주소>                               # 수집 + 해부 + 내 버전 + 화면 열기
rebiz fill report.json [--agent claude]    # 모은 자료만으로 빈칸 채우기
rebiz build report.json --topic "내 주제"   # 내 버전 출발점 만들기 + 겹침 검사
rebiz apply report.json --to ./my-project  # 내 프로젝트 첫 화면과 비교해 보강 (--agent 시 새 git 브랜치에서 적용)
rebiz view report.json --mine ./my-version # 오프라인 단일 HTML 뷰어 생성
rebiz video report.json --mine ./my-version # 9:16(1080x1920) 무음 영상 저장
rebiz check report.json [--dissect-only]   # 스키마와 근거 규칙 검사
rebiz clone-check ./my-version --source source.json # 원본 문구·이름·이미지 겹침 검사
```

## 지켜야 할 선

1. 로그인, 결제, 유료벽, CAPTCHA 를 우회하지 않고 가짜 계정을 만들지 않습니다.
2. 로그인 뒤 화면이나 비공개 자료를 모으지 않습니다.
3. `robots.txt` 와 `Crawl-delay` 를 지키고, 최대 5장 · 요청 사이 2초 이상 · GET 전용으로 읽습니다.
4. 약관 상태를 기록하고, 남의 사이트에서 코드 분석 금지 시 속 읽기를 건너뜁니다.
5. 원본 코드·문구·이미지·로고·브랜드 이름을 가져오지 않고 `"○○ 클론"` 이라고 부르지 않습니다.
6. 추정은 추정으로, 모르는 것은 모름으로, 수익/사용자 숫자는 공개 출처가 있을 때만 적습니다.

## 대표 예시 & 개발

![구조 비교](examples/aicitybuilders-vibecoding/structure-compare.png)

- 예시 파일: [examples/aicitybuilders-vibecoding](examples/aicitybuilders-vibecoding)
- 테스트: `npm test` (`ubuntu-latest`, `macos-latest`, `windows-latest` × Node 20/22 CI 검증)
- 안내 문서: [AGENTS.md](AGENTS.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md)

## 라이선스

- REA([github.com/morluto/rea](https://github.com/morluto/rea))는 MIT 라이선스의 별개 도구이며, 본 저장소는 REA 코드를 포함하지 않고 동의 후 공식 `rea-agents` 만 호출합니다.
- MIT License. Copyright (c) 2026 CONNECT AI LAB. [LICENSE](LICENSE)

<!-- team:start -->
## CONNECT AI LAB의 AI 직원들

AI 직원을 하나씩 오픈소스로 만들고 있어요. 필요한 직원부터 데려가 쓰세요.

<table>
<tr><td width="34%" valign="top"><b>사업 해부 직원</b> · <b>지금 보는 직원</b><br><a href="https://github.com/wonseokjung/reversebusiness"><code>reversebusiness</code></a></td><td valign="top">사업 웹사이트 주소 하나 주면 그 사업이 어떻게 돈 버는지 읽어 줘요.</td></tr>
<tr><td width="34%" valign="top"><b>영상 편집 직원</b><br><a href="https://github.com/wonseokjung/connect-ai-video-motion"><code>connect-ai-video-motion</code></a></td><td valign="top">내 영상을 주면 몸을 피해서 빈자리에 모션그래픽을 넣어 줘요.</td></tr>
<tr><td width="34%" valign="top"><b>모션그래픽 직원</b><br><a href="https://github.com/wonseokjung/connect-ai-motion"><code>connect-ai-motion</code></a></td><td valign="top">글 몇 줄 주면 모션그래픽 영상을 만들어 줘요. 찍은 영상은 없어도 돼요.</td></tr>
<tr><td width="34%" valign="top"><b>마케팅팀</b><br><a href="https://github.com/wonseokjung/connect-ai-marketer"><code>connect-ai-marketer</code></a></td><td valign="top">내 브라우저에서 24시간 댓글, 리스닝, 업로드를 맡아요.</td></tr>
<tr><td width="34%" valign="top"><b>글쓰기 직원</b><br><a href="https://github.com/wonseokjung/connect-ai-writer"><code>connect-ai-writer</code></a></td><td valign="top">영상 하나 주면 플랫폼마다 내 말투로 글을 쓰고 사진까지 같이 만들어 줘요.</td></tr>
</table>
<!-- team:end -->
