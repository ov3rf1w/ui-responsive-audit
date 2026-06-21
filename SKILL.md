---
name: ui-responsive-audit
description: Complete Playwright-based UI responsiveness audit workflow for websites and web apps. Use when the user asks to audit responsiveness, check layout across desktop/tablet/iPad/mobile, verify heroes, capture screenshot series, find overflow/overlap/crop issues, inspect z-index/layering, or perform a Structiva-style UI QA pass without manually scrolling every breakpoint.
---

# UI-responsive-audit

Use this skill for a complete, evidence-driven responsiveness audit. The core rule is:
**sample first, then run the final matrix**. Never create hundreds of screenshots before
confirming that the capture state is useful.

## Required Workflow

1. **Build production output first.**
   - Next static export: `npm run build`, then serve `out/`.
   - Do not use the dev server for screenshots.
   - If a build fails with a missing `.next/server/...` module after compile succeeds, remove only the project-local `.next` folder and rebuild.

2. **Start a local static server.**
   - Prefer the bundled script:
     ```powershell
     node C:\Users\rapha\.codex\skills\ui-responsive-audit\scripts\static-serve.mjs
     ```
   - It serves `out/` on `http://localhost:3100` by default.

3. **Run a small hero sample before any large capture.**
   - Include the main home hero, one index/listing hero, and one detail/page hero.
   - Include iPad portrait and landscape, not just desktop/mobile.
   - Seed cookie consent or close overlays so the page itself is visible.
   - Wait for entrance animation completion before screenshotting (`CAPTURE_DELAY=1800` is a good default).

4. **Inspect the sample.**
   - Reject samples if the cookie banner covers the page, animations are mid-frame, fonts are not loaded, or a modal/overlay dominates.
   - Check hero crop, CTA visibility, nav density, first-fold proof/trust elements, image focal point, line breaks, and whether overlays sit above the image.
   - If a person image is used, the head/face must be visible unless an intentional art direction says otherwise. A body-only crop is a defect.

5. **Run non-visual and section audits.**
   - Use the script in `MODE=audit` for overflow, broken images, tap targets, hidden reduced-motion content, element occlusion, layering conflicts, person-image crop risks, and static content collisions.
   - Keep `SECTION_AUDIT=1` unless the task is explicitly hero-only.
   - Include midpage sections that commonly fail on tablets: reviews/testimonials, pricing, package cards, process steps, CTA bands, comparison grids, sticky panels, and media-over-card layouts.
   - Check the normal scroll state, not only `scrollIntoViewIfNeeded`. Fixed headers, cookie layers, sticky rails, and chat widgets must not cover section content.
   - Check static sibling collisions inside sections. Large headings must not visually run into paragraphs, cards, tables, or definition lists.
   - Treat audit findings as triage. Confirm likely false positives with targeted screenshots.

6. **Fix and re-check only affected states.**
   - Re-capture the smallest useful set after each fix.
   - For midpage defects, capture `SECTION_SCREENSHOTS=1` on the affected route/viewport set.
   - Do not regenerate a full screenshot series until sample and audit are clean.

7. **Final deliverables.**
   - Provide:
     - audit JSON path and summary counts
     - sample screenshot folder
     - final screenshot folder(s)
     - what was fixed
     - `npm run lint` and `npm run build` results

## Bundled Scripts

Run scripts from the project root so output lands inside the project.

### Static server

```powershell
node C:\Users\rapha\.codex\skills\ui-responsive-audit\scripts\static-serve.mjs
```

Environment:
- `ROOT=out`
- `PORT=3100`

### Audit and capture

```powershell
node C:\Users\rapha\.codex\skills\ui-responsive-audit\scripts\ui-responsive-audit.mjs
```

Useful environment:
- `MODE=audit|capture`
- `BASE=http://localhost:3100`
- `ROUTES="/,/standorte/,/standorte/eisenstadt/"`
- Leave `ROUTES` unset to auto-discover routes from `out/**/index.html`.
- `EXPORT_ROOT=out`
- `VIEWPORTS="desktop-1440x900,ipad-mini-portrait-768x1024,phone-393x852"`
- `CUSTOM_VIEWPORTS='[{"name":"custom-820x1180","width":820,"height":1180,"device":"tablet"}]'`
  - Shorthand is also supported: `CUSTOM_VIEWPORTS="custom-820x1180:820x1180:tablet"`.
  - Unknown `VIEWPORTS` names must fail the run. Do not accept silently skipped breakpoints.
- `SECTIONS=".reviews-section,.pricing-section,#kontakt"` or leave unset to auto-discover major sections.
- `SECTION_AUDIT=1` to audit major sections for fixed/sticky overlay collisions.
- `SECTION_SCROLL_MODE=natural|direct|both`
  - Use `natural` for the normal user scroll state.
  - Use `both` when anchor links, sticky headers, or section screenshots are suspected.
- `SECTION_SCREENSHOTS=1` to capture viewport screenshots of section states in capture mode.
- `SECTION_LIMIT=24`
- `CONSENT=1`
- `SERIES=hero-sample`
- `HERO=1 FULL=0 SLICES=0`
- `CAPTURE_DELAY=1800`

Example sample-first pass:

```powershell
$env:MODE='capture'
$env:CONSENT='1'
$env:SERIES='hero-sample'
$env:ROUTES='/,/standorte/,/standorte/eisenstadt/'
$env:VIEWPORTS='desktop-1440x900,ipad-mini-portrait-768x1024,ipad-mini-landscape-1024x768,ipad-air-portrait-820x1180,phone-393x852'
$env:HERO='1'; $env:FULL='0'; $env:SLICES='0'
node C:\Users\rapha\.codex\skills\ui-responsive-audit\scripts\ui-responsive-audit.mjs
```

Example audit without screenshot flood:

```powershell
$env:MODE='audit'
# Leave ROUTES unset to audit every static route in out/.
node C:\Users\rapha\.codex\skills\ui-responsive-audit\scripts\ui-responsive-audit.mjs
```

Example targeted section pass:

```powershell
$env:MODE='audit'
$env:CONSENT='1'
$env:ROUTES='/'
$env:VIEWPORTS='ipad-mini-landscape-1024x768,ipad-air-landscape-1180x820,ipad-pro-12-portrait-1024x1366'
$env:SECTIONS='.reviews-section,.pricing-section,.faq-section'
$env:SECTION_SCROLL_MODE='both'
node C:\Users\rapha\.codex\skills\ui-responsive-audit\scripts\ui-responsive-audit.mjs
```

## Viewport Set

Use common monitors plus real iPad classes:
- Desktop: `1920x1080`, `1536x864`, `1440x900`, `1366x768`, `1280x720`
- iPad Mini: `768x1024`, `1024x768`
- iPad Air: `820x1180`, `1180x820`
- iPad Pro 11: `834x1194`, `1194x834`
- iPad Pro 12.9: `1024x1366`, `1366x1024`
- Phones: `430x932`, `393x852`, `390x844`, `360x800`

## What to Catch

Hard failures:
- horizontal page overflow
- broken images
- sub-44px tap targets on touch viewports
- hidden content in `prefers-reduced-motion`
- text/buttons visually occluded by another element
- overlay content intended to sit above media but rendered underneath
- fixed/sticky headers, cookie layers, chat widgets, or sticky rails covering midpage section content
- headings, paragraphs, cards, tables, or definition lists overlapping inside the same section
- person/portrait image crop risk where the top/head area is cut away

Visual quality failures:
- hero first viewport feels clipped or crowded
- nav/logo/CTA crowd the message
- first CTA falls below the fold without intent
- image focal point misses the person/product/place
- full-page image downsampling hides detail; use viewport slices for mobile detail
- screenshots captured during entrance animation
- cookie/modal overlay covers the page in final QA screenshots
- only hero screenshots were captured while midpage sections were untested

For detailed triage rules, read `references/audit-method.md`.
