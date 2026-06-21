# UI Responsiveness Audit Method

## Table of Contents

1. Sample-first gate
2. Non-visual geometry checks
3. Person and hero image crop checks
4. Layering and z-index checks
5. Midpage section and scroll-state checks
6. Final screenshot strategy
7. Reporting format

## 1. Sample-first gate

Do not start with a giant matrix. First capture:
- home hero
- one index/listing hero
- one detail hero
- one legal/text-heavy page when legal pages exist

Use:
- `desktop-1440x900`
- `ipad-mini-portrait-768x1024`
- `ipad-mini-landscape-1024x768`
- `ipad-air-portrait-820x1180`
- `phone-393x852`
- `phone-small-360x800`

Reject the sample if:
- cookie banner or modal hides the page
- hero animation is mid-frame
- fonts are not loaded
- visible page is not representative of user state
- screenshots are too downsampled to read

Only after the sample passes, run larger screenshot sets.

## 2. Non-visual geometry checks

Use DOM geometry before screenshots to target likely defects:

- **Horizontal overflow:** compare `documentElement.scrollWidth` to `clientWidth`; list visible elements crossing the viewport.
- **Tap target size:** check visible links/buttons/inputs under 44x44px.
- **Text clipping:** list elements where `scrollWidth > clientWidth` or `scrollHeight > clientHeight`.
- **Occlusion:** sample points inside text/button elements and compare `elementFromPoint`/`elementsFromPoint` to expected element ancestry.
- **Layer conflict:** when text/button overlays an `img`, `video`, or `canvas`, the text/button must appear above media at sampled points.
- **Reduced motion:** run the same audit with `reducedMotion: "reduce"`; hidden reveal elements under reduced motion are correctness defects.

Treat unknown viewport names as audit setup failures. A missing screenshot because a preset was misspelled is worse than a loud script error.

Treat these as triage, not final judgment. Some overlaps are intentional: badges on images, cards over media, sticky nav over hero. When an overlap is intentional, verify z-order and readability with a targeted screenshot.

## 3. Person and hero image crop checks

Any image that likely contains a person needs explicit focal-point QA.

Flag likely person images when:
- `alt` includes `portrait`, `coach`, `trainer`, a person name, `team`, `founder`, `owner`
- `src` includes person-like tokens such as `raphael`, `portrait`, `coach`, `trainer`, `person`
- the image is inside a hero/media component

For `object-fit: cover`, compute the hidden crop from intrinsic and rendered dimensions:
- high top crop with `object-position: center center` is risky on portrait/tablet stacked layouts
- top crop near zero with `object-position: center top` is usually safer for people

Visual rule:
- head/face visible beats centered torso
- body-only crop is a defect unless intentionally documented
- for cards/panels over person images, check that the overlay does not cover the face

Useful fixes:
- set `object-position: center top` for stacked/tablet/mobile person heroes
- use route-specific classes or data attributes for focal points
- reduce media height only after confirming face remains visible

## 4. Layering and z-index checks

Audit whether overlap is intended and correctly layered:

- Text over image must be readable and above the image in `elementsFromPoint`.
- Overlay cards on images must sit above the image and below fixed nav/modals.
- Decorative overlays/scrims may sit between image and text, but must not cover interactive elements.
- Fixed headers may overlap heroes; they must not hide the logo, H1, CTA, or breadcrumbs.

When the audit finds overlap:
1. Identify both elements and their rectangles.
2. Decide whether the overlap is intentional.
3. If intentional, verify z-order and contrast with a cropped screenshot.
4. If accidental, fix layout spacing, stacking context, or responsive composition.

## 5. Midpage section and scroll-state checks

Do not treat hero screenshots as a complete responsiveness audit. Midpage sections often fail first on iPad and tablet widths.

Always consider:
- reviews/testimonials
- pricing/package cards
- process steps
- FAQ/details lists
- CTA bands
- local SEO/text-heavy blocks
- sticky sidebars/rails
- cards over images or images under cards

Use `SECTIONS` for known critical selectors. Leave it unset for automatic major-section discovery when doing a broader pass.

Check two different states when a defect is plausible:
- **natural scroll:** the user scrolls down into the section; auto-hiding headers should usually be hidden.
- **direct scroll:** the browser jumps directly to the section; anchors and screenshots may reveal fixed-header collisions.

Fixed/sticky overlay collisions should include:
- site header over text/cards/buttons
- cookie banner over final screenshots
- chat widget over CTA/buttons
- sticky rail covering content it should sit beside

Use `SECTION_SCREENSHOTS=1` for affected routes and tablet viewports. These screenshots must be viewport screenshots after scroll, not isolated element screenshots, because fixed overlays disappear from isolated element crops.

## 6. Final screenshot strategy

Final screenshots should be useful, not maximal:

- **Hero matrix:** all major routes/page types across common desktop, iPad, and mobile viewports.
- **Section matrix:** critical midpage selectors on tablet/iPad widths plus one phone width.
- **Mobile slices:** one readable mobile viewport (`393x852`) across all routes.
- **Reduced motion:** one mobile reduced-motion pass, hero + key slices.
- **Full-page overviews:** only for representative route types or pages changed in this task.

Avoid:
- thousands of duplicate screenshots
- full-page mobile PNGs as the only proof
- final series with cookie banners
- captures before entrance animation settles
- isolated element screenshots as the only proof for fixed/sticky overlay issues

## 7. Reporting format

Report:

```text
Findings:
- [route + viewport] issue, evidence path, fix

Automated audit:
- result count
- failure count
- tap target count
- report path

Screenshots:
- sample path
- final hero path
- section screenshot path
- mobile slices path
- reduced motion path

Verification:
- npm run lint
- npm run build
```
