# Changelog

## 0.3.0 - 2026-06-21

- Added static sibling-content collision detection inside section audits.
- Added detection for oversized headings crossing into paragraphs, cards, tables, panels, or definition lists without triggering page overflow.
- Fixed Windows static-server route resolution for nested routes such as `/standorte/`.

## 0.2.0 - 2026-06-21

- Added midpage section audits for reviews, pricing, CTAs, cards, sticky panels, and other non-hero sections.
- Added fixed/sticky overlay collision detection for section content.
- Added `SECTIONS`, `SECTION_AUDIT`, `SECTION_SCROLL_MODE`, `SECTION_LIMIT`, and `SECTION_SCREENSHOTS`.
- Added section viewport screenshots so fixed headers, cookie banners, and sticky overlays remain visible in evidence captures.
- Documented the normal-scroll versus direct-scroll distinction for tablet/header issues.

## 0.1.0 - 2026-06-21

- Initial Codex skill release.
- Added sample-first responsiveness workflow.
- Added Playwright audit script with route discovery, viewport presets, overlap checks, text clipping checks, tap-target hints, layer conflict checks, and person-image crop risk detection.
- Added screenshot capture mode for hero, full-page, and scroll-slice series.
- Added static server for production `out` directories.
- Added OpenAI agent metadata.
