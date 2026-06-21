# UI-responsive-audit

`UI-responsive-audit` is a Codex skill for running disciplined, Playwright-based responsiveness audits on websites and web apps. It combines a sample-first screenshot workflow with DOM geometry checks so teams can find layout failures before generating hundreds of screenshots.

The skill is built for Structiva-style UI QA: production builds, real browser rendering, practical breakpoint coverage, and focused follow-up captures for the exact states that need human review.

## What It Checks

- Horizontal overflow across desktop, tablet, iPad, and phone viewports
- Broken or invisible images
- Text clipping and suspicious zero-size content
- Tap-target issues on touch devices
- Reveal/animation content that remains hidden after the page settles
- Element overlap and z-index conflicts
- Text and UI layers that accidentally fall behind media
- Person-image crop risk, especially head and face crops on portrait/tablet layouts
- Midpage section checks for reviews, pricing, CTA bands, card grids, sticky panels, and other non-hero sections
- Fixed/sticky overlay collision checks, including headers, cookie layers, chat widgets, and sticky rails
- Static sibling-content collision checks, including oversized headings crossing into paragraphs, cards, tables, or definition lists
- Cookie-overlay handling and repeatable consent state
- Hero, section, full-page, and scroll-slice screenshot series

## Why Sample First

Large screenshot matrices are expensive to review and often become useless if the capture setup is wrong. This workflow starts with a small representative set:

- home page
- one visual detail route
- one content/legal route
- desktop
- iPad portrait and landscape
- phone portrait

Only after the sample is useful should the full audit/capture matrix run.

## Install As A Codex Skill

Clone this repository into your Codex skills directory:

```powershell
git clone https://github.com/ov3rf1w/ui-responsive-audit.git "$env:USERPROFILE\.codex\skills\ui-responsive-audit"
```

Restart Codex or reload skills. Then ask Codex for `$ui-responsive-audit` or request a responsive UI audit.

## Requirements

- Node.js 20+
- A website or app that can be served locally
- `playwright-core` available in the audited project
- A production build when possible

The audit script intentionally resolves `playwright-core` from the target project, not from this skill repository. This keeps browser automation aligned with the app being audited.

## Quick Start

From the target website repository:

```powershell
npm run build
node "$env:USERPROFILE\.codex\skills\ui-responsive-audit\scripts\static-serve.mjs"
```

In another terminal:

```powershell
$env:BASE = "http://127.0.0.1:3100"
$env:MODE = "audit"
$env:CONSENT = "1"
node "$env:USERPROFILE\.codex\skills\ui-responsive-audit\scripts\ui-responsive-audit.mjs"
```

For a screenshot sample:

```powershell
$env:MODE = "capture"
$env:SERIES = "sample"
$env:ROUTES = "/,/standorte/,/datenschutz/"
$env:VIEWPORTS = "desktop-1440x900,ipad-mini-portrait-768x1024,ipad-mini-landscape-1024x768,phone-393x852"
$env:HERO = "1"
$env:FULL = "0"
$env:SLICES = "0"
node "$env:USERPROFILE\.codex\skills\ui-responsive-audit\scripts\ui-responsive-audit.mjs"
```

## Configuration

The audit script is configured through environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `BASE` | `http://127.0.0.1:3100` | Base URL to audit |
| `MODE` | `audit` | `audit` for DOM checks, `capture` for screenshots |
| `OUT` | `output/playwright/ui-responsive-audit` | Output directory inside the target project |
| `EXPORT_ROOT` | target project root | Where output is written |
| `ROUTES` | auto-discovered from `out/**/index.html`, fallback `/` | Comma-separated route list |
| `VIEWPORTS` | all presets | Comma-separated viewport preset names |
| `CUSTOM_VIEWPORTS` | empty | Extra viewports as JSON or shorthand `name:widthxheight[:desktop|tablet|mobile]` |
| `SECTIONS` | auto-discovered major sections | Comma-separated critical section selectors, for example `.reviews-section,.pricing-section,#kontakt` |
| `SECTION_AUDIT` | `1` | Audit major sections for fixed/sticky overlay collisions |
| `SECTION_SCROLL_MODE` | `natural` | `natural`, `direct`, or `both`; use `both` for anchor/header issues |
| `SECTION_LIMIT` | `24` | Maximum auto-discovered sections per route |
| `SECTION_SCREENSHOTS` | `0` | Capture viewport screenshots of section states in capture mode when set to `1` |
| `CONSENT` | `0` | Set `1` to inject a localStorage consent payload |
| `CONSENT_KEY` | `rw-cookie-consent` | Consent localStorage key |
| `CONSENT_PAYLOAD` | versioned analytics/marketing denied JSON | Consent localStorage value |
| `REDUCE` | `1` | Emulate reduced motion |
| `HERO` | `1` | Capture first viewport screenshots in capture mode |
| `FULL` | `0` | Capture full-page screenshots in capture mode when set to `1` |
| `SLICES` | `0` | Capture scroll slices in capture mode when set to `1` |
| `CAPTURE_DELAY` | `450` | Wait time after load before screenshots/checks |

## Section Audits

Hero screenshots are not enough for a full responsive audit. Tablet issues often appear in midpage sections where long text, sticky sidebars, review cards, pricing cards, or fixed headers interact.

Run a targeted section audit:

```powershell
$env:MODE = "audit"
$env:CONSENT = "1"
$env:ROUTES = "/"
$env:VIEWPORTS = "ipad-mini-landscape-1024x768,ipad-air-landscape-1180x820,ipad-pro-12-portrait-1024x1366"
$env:SECTIONS = ".reviews-section,.pricing-section,.faq-section"
$env:SECTION_SCROLL_MODE = "both"
node "$env:USERPROFILE\.codex\skills\ui-responsive-audit\scripts\ui-responsive-audit.mjs"
```

Capture section evidence as viewport screenshots:

```powershell
$env:MODE = "capture"
$env:CONSENT = "1"
$env:ROUTES = "/"
$env:VIEWPORTS = "ipad-mini-landscape-1024x768,ipad-air-landscape-1180x820"
$env:SECTIONS = ".reviews-section"
$env:HERO = "0"
$env:FULL = "0"
$env:SLICES = "0"
$env:SECTION_SCREENSHOTS = "1"
node "$env:USERPROFILE\.codex\skills\ui-responsive-audit\scripts\ui-responsive-audit.mjs"
```

Section screenshots are viewport screenshots after scroll, not isolated element crops. That is intentional: fixed headers, cookie banners, chat widgets, and sticky rails must remain visible if they cover content.

The section audit also compares visible content rectangles inside a section. This catches issues that do not create page overflow, such as a huge display heading visually entering a neighboring text column while `overflow: visible` keeps the browser from reporting clipping.

## Viewport Presets

Desktop:

- `desktop-1920x1080`
- `desktop-1536x864`
- `desktop-1440x900`
- `laptop-1366x768`
- `small-desktop-1280x720`

Tablet and iPad:

- `ipad-mini-portrait-768x1024`
- `ipad-mini-landscape-1024x768`
- `ipad-air-portrait-820x1180`
- `ipad-air-landscape-1180x820`
- `ipad-pro-11-portrait-834x1194`
- `ipad-pro-11-landscape-1194x834`
- `ipad-pro-12-portrait-1024x1366`
- `ipad-pro-12-landscape-1366x1024`

Phones:

- `phone-large-430x932`
- `phone-393x852`
- `phone-390x844`
- `phone-small-360x800`

## Outputs

Audit mode writes a JSON report:

```text
output/playwright/ui-responsive-audit/audit-<timestamp>.json
```

Capture mode writes PNG screenshot series plus a manifest:

```text
output/playwright/ui-responsive-audit/shots-<series>-<timestamp>/
```

The manifest includes the route, viewport, URL, screenshot type, and dimensions for every capture.

## Recommended Audit Process

1. Build and serve the production output.
2. Run a small sample screenshot series.
3. Review whether captures are stable, useful, and represent the real page state.
4. Run audit mode over the full viewport/route matrix.
5. Run a section audit for critical midpage selectors, especially on tablet/iPad widths.
6. Fix hard failures first: overflow, clipping, broken images, bad crop risk, static content overlap, fixed/sticky overlay collisions, and layering conflicts.
7. Re-run audit mode on affected routes.
8. Capture the final screenshot series for user review.
9. Report exact audit paths, screenshot folders, and remaining risks.

## Local Validation

Inside this repository:

```powershell
npm run validate
```

This checks the JavaScript syntax for the bundled scripts.

For Codex skill validation:

```powershell
python "$env:USERPROFILE\.codex\skills\.system\skill-creator\scripts\quick_validate.py" .
```

## Contributing

Issues and pull requests should include:

- target app context
- route and viewport where the issue occurs
- relevant audit JSON excerpt or screenshot
- expected behavior
- actual behavior

## License

MIT
