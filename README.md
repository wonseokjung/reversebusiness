<p align="center">
  <b>CONNECT AI LAB · AI Education for Everyone</b><br>
  <a href="https://www.youtube.com/@CONNECT-AI-LAB">YouTube CONNECT AI LAB</a> · <a href="https://www.aicitybuilders.com">Courses: aicitybuilders.com</a>
</p>

<p align="center">
  <b>English</b> | <a href="README.ko.md">한국어 (Korean)</a>
</p>

# reversebusiness

![Dissection scene: page blocks pull apart into attract, value, pay, and return layers connected to the money flow and your own version](docs/hero.gif)

**Give it one business URL and dissect how the business works.** Learn who pays and why, how users arrive and convert, and how the landing page is structured — then generate a clean-room starter site for your own product without copying a single word, image, color, or line of code.

```bash
npx github:wonseokjung/reversebusiness
```

**One command installs the `reversebusiness` skill (and optionally [REA](https://github.com/morluto/rea) after you confirm).** Zero npm dependencies, Node 18+ (`macOS · Windows · Linux`; REA requires `Node 22.19+`, `24.11+`, or `26+`).

<p align="center">
  <img src="skill/reversebusiness/assets/mascot/greet.gif" width="68" alt="Joseon Damo Investigator · Greet">&nbsp;
  <img src="skill/reversebusiness/assets/mascot/collect.gif" width="68" alt="Joseon Damo Investigator · Collect">&nbsp;
  <img src="skill/reversebusiness/assets/mascot/dissect.gif" width="68" alt="Joseon Damo Investigator · Dissect">&nbsp;
  <img src="skill/reversebusiness/assets/mascot/done.gif" width="68" alt="Joseon Damo Investigator · Done"><br>
  <sub><b>Joseon Damo · Business Investigator</b> (CONNECT AI HQ PixelCrew) — gently animated pixel portrait that switches expression as it greets, gathers public evidence, dissects the 6 boxes, and finishes your clean-room report.</sub>
</p>

## Quick start (30 seconds)

1. Run the command above in your terminal. It detects installed coding agents (`Claude Code`, `Codex`, `Gemini CLI`, `Cursor`, `Antigravity`), shows the exact paths it will update, asks before installing, and asks separately before setting up `rea-agents` (`--no-rea` skips REA, `--yes` confirms automatically).
2. A live example dissection report opens in your browser.
3. Ask your coding agent:

   ```text
   Use reversebusiness to dissect https://example.com
   ```

Or pass a URL directly from your terminal for a **one-stop pass**:

```bash
npx github:wonseokjung/reversebusiness https://example.com --agent claude --yes
```

- **Live browser capture:** On desktop (`macOS` / `Windows` / GUI `Linux`), Chrome opens visibly with a temporary clean profile so you can watch sections get scanned and FAQ/pricing tabs expand in real time (pass `--headless` to hide Chrome, or `--no-render` to fetch HTML only).
- **One-stop agent completion:** With `--agent claude` or `--agent codex` (or `[Y/n]` in interactive terminals), it fills all interpretive cells, writes your clean-room cell 6 spec, generates `./my-version/`, runs overlap checks, and opens the finished `report.html`. Use `--no-fill` to inspect the raw draft first.
- **Language support:** CLI messages and the single-file HTML viewer auto-detect English or Korean from your locale, or you can force either with `--lang en` or `--lang ko`.

| Option | What it does |
|---|---|
| `--yes`, `-y` | Confirm installation or agent runs without prompting |
| `--dry-run` | Show what would change without downloading or editing files |
| `--lang en \| ko` | Set terminal output and viewer language |
| `--headless` | Run Chrome headless instead of showing the live browser window |
| `--agent <name>` | Target agent(s) for install (`claude,codex,cursor,gemini,antigravity,agents`) or single run (`claude` / `codex`) |
| `--no-rea` | Skip the REA install prompt and use the built-in collector |
| `--no-fill` | Stop after initial URL capture without running an AI agent |
| `--topic "<text>"` | Set the product/niche topic for your clean-room version |
| `--own` | Mark the URL as your own site (enables static script route/trace checks) |
| `--remove` | Remove skills installed by `reversebusiness` (leaves REA untouched) |

## Four stages

| Stage | What happens | Output |
|---|---|---|
| 1. Read | Check `robots.txt` and terms first, then gather grounded evidence from up to 5 public pages | `source.json`, `requests.json`, `evidence/` |
| 2. Dissect | Fill six fixed cells (`Money`, `Flow`, `Map`, `Tech`, `Evidence / Unknowns`, `My Version`). Every claim is tagged `observed`, `inferred`, `code`, or `unknown` | `report.json`, single-file `report.html` |
| 3. Build my version | Generate a clean-room starter site from cell 6 and the learned section order using neutral layout and placeholder copy | `my-version/` (`index.html`, `style.css`) |
| 4. Check | Verify zero copied phrases (5+ consecutive words), target brand names, domains, or asset URLs | Overlap check pass/fail |

Need analysis only? Pass `--dissect-only` to validate cells 1–5 while leaving cell 6 empty.

## Three reading depths (with REA)

When [REA (`rea-agents`)](https://github.com/morluto/rea) is present (or installed after your confirmation), `reversebusiness` switches to precise mode inside the same isolated temporary browser:

| Depth | What it inspects | What it captures | Hard boundaries |
|---|---|---|---|
| 1. Surface | Rendered DOM text, layout rects, headings, CTAs, storage key names | Actual prices, visible structure, block weights | Never reads cookie or storage values |
| 2. Flow | Clicks only safe expanders (pricing tabs, FAQ accordions, "more"); records attempted hosts | Tab-hidden pricing, payment/analytics/video hosts | Never clicks login, signup, checkout, forms, or outbound links; keeps no payloads/tokens |
| 3. Code | Scans already-downloaded JS bundles passively (skipped if terms forbid code analysis unless `--own`) | Route names behind auth, payment SDK clues, price-like strings | Never calls discovered endpoints; marks all code-only clues as `code` trace, never `observed` |

## Commands after dissection

Once `report.json` exists, every command prints the exact next step:

```bash
rebiz <URL>                               # Capture + dissect + build + view
rebiz fill report.json [--agent claude]   # Fill unknowns using already-collected evidence only
rebiz build report.json --topic "my niche" # Build clean-room starter site + run overlap check
rebiz apply report.json --to ./my-app     # Diff your landing screen vs learned skeleton (safe git branch with --agent)
rebiz view report.json --mine ./my-version # Render offline interactive HTML viewer
rebiz video report.json --mine ./my-version # Export silent 9:16 (1080x1920) dissection video
rebiz check report.json [--dissect-only]  # Validate report schema and evidence grounding
rebiz clone-check ./my-version --source source.json # Check for copied copy, names, domains, or assets
```

## Non-negotiable boundaries

1. **No bypassing gates.** Never bypass logins, paywalls, rate limits, or CAPTCHAs; never create fake accounts.
2. **Public data only.** Never collect behind-login screens, user data, or leaked material.
3. **Human pacing.** Respect `robots.txt` and `Crawl-delay`, max 5 pages per run, 2s+ delay, `GET` only, no cookies sent.
4. **Terms recorded.** Record terms status in `meta.terms`; skip static JS analysis whenever terms restrict it on third-party sites.
5. **Clean-room build.** Never reuse target code, copy, logos, icons, fonts, or color palettes. Never name your product an `<X> clone`.
6. **Honest labels.** Observed facts require page/flow evidence; deductions are marked `inferred`; unknown metrics stay `unknown`; revenue/user claims require a public source URL.

## Viewer features

A single self-contained HTML file that works completely offline (`--lang en` / `--lang ko`, live toggle button included):

- **Dissection scene** — Interactive layered wireframe pulling apart into attract, value, pay, and return bands.
- **Money flow diagram** — Arrive -> First value -> Signup -> Payment -> Return with status tags, evidence links, and third-party services.
- **Skeleton to My Version slider** — Compare the learned section architecture against your generated clean-room page side by side.
- **9:16 video export** — Export a silent 1080x1920 short video right in Chrome (or headless via `rebiz video`).

![Structure comparison: learned target skeleton on the left and clean-room starter version on the right](examples/aicitybuilders-vibecoding/structure-compare.png)

See a full real-world example in [`examples/aicitybuilders-vibecoding`](examples/aicitybuilders-vibecoding).

## Development & testing

```bash
npm test
node bin/rebiz.mjs --dry-run
```

Cross-platform CI (`.github/workflows/test.yml`) runs the full suite on `ubuntu-latest`, `macos-latest`, and `windows-latest` across Node 20 and Node 22 using local test fixtures and fake agent/REA shims. See [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), and [SECURITY.md](SECURITY.md).

## Attribution & License

- [REA: Reverse Engineer Anything](https://github.com/morluto/rea) (MIT License, Copyright (c) 2026 morluto) is an independent tool. `reversebusiness` contains no REA code and calls the official `rea-agents` package only after explicit user confirmation.
- **reversebusiness**: MIT License, Copyright (c) 2026 CONNECT AI LAB. See [LICENSE](LICENSE).

<!-- team:start -->
## CONNECT AI LAB's AI Agent Team (14) · ELDO Browser

I build AI agents in the open, one by one. Grab the one you need, or browse and hire all 14 with [ELDO Browser](https://eldobrowser.com) and [`wonseokjung/eldo`](https://github.com/wonseokjung/eldo) (`npx github:wonseokjung/eldo`).

<table>
<tr><td width="34%" valign="top"><b>ELDO Browser · Open-Source Hub</b><br><a href="https://eldobrowser.com"><code>eldobrowser.com</code></a> · <a href="https://github.com/wonseokjung/eldo"><code>eldo</code></a></td><td valign="top">The free Browser for AI Agents (Apple Notarized macOS &amp; Windows). Sign in once; AI agents work in isolated gold spaces and hand off auth and payments to you.</td></tr>
<tr><td width="34%" valign="top"><b>AI autonomous company HQ</b><br><a href="https://github.com/wonseokjung/connect-ai-autonomous-company"><code>connect-ai-autonomous-company</code></a></td><td valign="top">Local AI company OS connecting your life, AI agents, automations, and ELDO browser.</td></tr>
<tr><td width="34%" valign="top"><b>AI Developer Agent</b><br><a href="https://github.com/wonseokjung/connect-ai-developer"><code>connect-ai-developer</code></a></td><td valign="top">One sentence in, a service with sign-up, database, test payments, GitHub and deploy plans out.</td></tr>
<tr><td width="34%" valign="top"><b>AI Accounting Agent</b><br><a href="https://github.com/wonseokjung/connect-ai-accountant"><code>connect-ai-accountant</code></a></td><td valign="top">Receipts, 홈택스, card and bank in. A monthly sheet and a package for your tax accountant out.</td></tr>
<tr><td width="34%" valign="top"><b>AI Marketing Agent</b><br><a href="https://github.com/wonseokjung/connect-ai-marketer"><code>connect-ai-marketer</code></a></td><td valign="top">8 AI teammates handling replies, social listening and YouTube uploads 24/7 in your browser.</td></tr>
<tr><td width="34%" valign="top"><b>AI Writing Agent</b><br><a href="https://github.com/wonseokjung/connect-ai-writer"><code>connect-ai-writer</code></a></td><td valign="top">Give it one video or topic; it researches and writes platform posts in your voice, with pictures.</td></tr>
<tr><td width="34%" valign="top"><b>AI Business Analysis Agent</b> · <b>this one</b><br><a href="https://github.com/wonseokjung/reversebusiness"><code>reversebusiness</code></a></td><td valign="top">Give it a website URL, and it breaks down how that business makes money and designs your version.</td></tr>
<tr><td width="34%" valign="top"><b>AI Image Agent</b><br><a href="https://github.com/wonseokjung/connect-ai-image"><code>connect-ai-image</code></a></td><td valign="top">Free-first local ComfyUI + FLUX or logged-in browser image series for every platform.</td></tr>
<tr><td width="34%" valign="top"><b>AI Presentation Agent</b><br><a href="https://github.com/wonseokjung/connect-ai-slides-web"><code>connect-ai-slides-web</code></a></td><td valign="top">Turn a few lines or an old PPT into a motion-first 3D web deck and a real PowerPoint (.pptx) file.</td></tr>
<tr><td width="34%" valign="top"><b>AI Web 3D Agent</b><br><a href="https://github.com/wonseokjung/connect-ai-three"><code>connect-ai-three</code></a></td><td valign="top">Say it, get an interactive Three.js 3D web page and a frame-exact film from one spec.</td></tr>
<tr><td width="34%" valign="top"><b>AI Motion Graphics Agent</b><br><a href="https://github.com/wonseokjung/connect-ai-motion"><code>connect-ai-motion</code></a></td><td valign="top">Give it a few lines of text, and it makes a 16:9 and 9:16 motion graphics video. No footage needed.</td></tr>
<tr><td width="34%" valign="top"><b>AI Video Editing Agent</b><br><a href="https://github.com/wonseokjung/connect-ai-video-motion"><code>connect-ai-video-motion</code></a></td><td valign="top">Give it your video, and it puts 80 body-aware motion graphics in the empty space around you.</td></tr>
<tr><td width="34%" valign="top"><b>AI XR Agent</b><br><a href="https://github.com/wonseokjung/connect-ai-xr"><code>connect-ai-xr</code></a></td><td valign="top">Give it one sentence, and it makes a WebXR app for Meta Quest passthrough AR, VR, and desktop.</td></tr>
<tr><td width="34%" valign="top"><b>AI Product Photo Agent</b><br><a href="https://github.com/wonseokjung/connect-ai-product-photo"><code>connect-ai-product-photo</code></a></td><td valign="top">Drop phone product photos in a folder and get platform-ready studio shots keeping real sharp labels.</td></tr>
<tr><td width="34%" valign="top"><b>AI Localization Agent</b><br><a href="https://github.com/wonseokjung/connect-ai-localizer"><code>connect-ai-localizer</code></a></td><td valign="top">Rewrite your Korean post or subtitles natively for English, Japanese and Spanish in your own voice.</td></tr>
</table>
<!-- team:end -->
