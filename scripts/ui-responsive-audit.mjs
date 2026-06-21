import { createRequire } from "node:module";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.cwd());
const requireFromProject = createRequire(path.join(projectRoot, "package.json"));
const { chromium } = requireFromProject("playwright-core");

const BASE = process.env.BASE || "http://localhost:3100";
const MODE = process.env.MODE || "audit";
const OUT = path.resolve(projectRoot, process.env.OUT || "output/playwright/ui-responsive-audit");
const SERIES = process.env.SERIES ? `-${process.env.SERIES.replace(/[^a-z0-9_-]/gi, "-")}` : "";
const CAPTURE_HERO = process.env.HERO !== "0";
const CAPTURE_FULL = process.env.FULL === "1";
const CAPTURE_SLICES = process.env.SLICES === "1";
const CAPTURE_SECTIONS = process.env.SECTION_SCREENSHOTS === "1" || process.env.SECTION_SHOTS === "1";
const CAPTURE_DELAY = Number(process.env.CAPTURE_DELAY || 1800);
const SECTION_AUDIT = process.env.SECTION_AUDIT !== "0";
const SECTION_LIMIT = Number(process.env.SECTION_LIMIT || 24);
const SECTION_SCROLL_MODE = process.env.SECTION_SCROLL_MODE || "natural";

const EXPORT_ROOT = path.resolve(projectRoot, process.env.EXPORT_ROOT || "out");

const PRESET_VIEWPORTS = [
  { name: "desktop-1920x1080", width: 1920, height: 1080, device: "desktop" },
  { name: "desktop-1536x864", width: 1536, height: 864, device: "desktop" },
  { name: "desktop-1440x900", width: 1440, height: 900, device: "desktop" },
  { name: "laptop-1366x768", width: 1366, height: 768, device: "desktop" },
  { name: "small-desktop-1280x720", width: 1280, height: 720, device: "desktop" },
  { name: "ipad-mini-portrait-768x1024", width: 768, height: 1024, device: "tablet" },
  { name: "ipad-mini-landscape-1024x768", width: 1024, height: 768, device: "tablet" },
  { name: "ipad-air-portrait-820x1180", width: 820, height: 1180, device: "tablet" },
  { name: "ipad-air-landscape-1180x820", width: 1180, height: 820, device: "tablet" },
  { name: "ipad-pro-11-portrait-834x1194", width: 834, height: 1194, device: "tablet" },
  { name: "ipad-pro-11-landscape-1194x834", width: 1194, height: 834, device: "tablet" },
  { name: "ipad-pro-12-portrait-1024x1366", width: 1024, height: 1366, device: "tablet" },
  { name: "ipad-pro-12-landscape-1366x1024", width: 1366, height: 1024, device: "tablet" },
  { name: "phone-large-430x932", width: 430, height: 932, device: "mobile" },
  { name: "phone-393x852", width: 393, height: 852, device: "mobile" },
  { name: "phone-390x844", width: 390, height: 844, device: "mobile" },
  { name: "phone-small-360x800", width: 360, height: 800, device: "mobile" },
];

function parseCustomViewports() {
  const raw = process.env.CUSTOM_VIEWPORTS?.trim();
  if (!raw) return [];

  if (raw.startsWith("[")) {
    return JSON.parse(raw);
  }

  return raw.split(",").map((entry) => {
    const match = entry.trim().match(/^([a-z0-9_-]+):(\d+)x(\d+)(?::(desktop|tablet|mobile))?$/i);
    if (!match) {
      throw new Error(
        `Invalid CUSTOM_VIEWPORTS entry "${entry}". Use JSON or name:widthxheight[:desktop|tablet|mobile].`,
      );
    }

    return {
      name: match[1],
      width: Number(match[2]),
      height: Number(match[3]),
      device: match[4] || "custom",
    };
  });
}

function selectViewports(allViewports) {
  if (!process.env.VIEWPORTS) return allViewports;

  const requested = process.env.VIEWPORTS.split(",").map((name) => name.trim()).filter(Boolean);
  const byName = new Map(allViewports.map((viewport) => [viewport.name, viewport]));
  const missing = requested.filter((name) => !byName.has(name));

  if (missing.length > 0) {
    throw new Error(
      `Unknown VIEWPORTS value(s): ${missing.join(", ")}. Available: ${allViewports.map((viewport) => viewport.name).join(", ")}`,
    );
  }

  return requested.map((name) => byName.get(name));
}

const CUSTOM_VIEWPORTS = parseCustomViewports();
const ALL_VIEWPORTS = [...PRESET_VIEWPORTS, ...CUSTOM_VIEWPORTS];
const VIEWPORTS = selectViewports(ALL_VIEWPORTS);
const SECTION_SELECTORS = process.env.SECTIONS
  ? process.env.SECTIONS.split(",").map((selector) => selector.trim()).filter(Boolean)
  : [];

async function discoverRoutes() {
  if (process.env.ROUTES) {
    return process.env.ROUTES.split(",").map((route) => route.trim()).filter(Boolean);
  }

  const routes = [];
  async function walk(directory) {
    let entries = [];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_")) continue;
        await walk(fullPath);
        continue;
      }

      if (entry.name !== "index.html") continue;
      const relativeDirectory = path.relative(EXPORT_ROOT, directory).replaceAll("\\", "/");
      if (relativeDirectory === "404") continue;
      routes.push(relativeDirectory ? `/${relativeDirectory}/` : "/");
    }
  }

  await walk(EXPORT_ROOT);
  return [...new Set(routes)].sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)));
}

async function launchBrowser() {
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {}
  }
  return chromium.launch({ headless: true });
}

async function seedConsent(context) {
  if (process.env.CONSENT !== "1") return;

  const key = process.env.CONSENT_KEY || "rw-cookie-consent";
  const payload = process.env.CONSENT_PAYLOAD
    ? JSON.parse(process.env.CONSENT_PAYLOAD)
    : {
        necessary: true,
        functional: true,
        analytics: false,
        marketing: false,
        timestamp: new Date().toISOString(),
        version: 2,
      };

  await context.addInitScript(
    ({ key, payload }) => window.localStorage.setItem(key, JSON.stringify(payload)),
    { key, payload },
  );
}

async function settle(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.waitForTimeout(MODE === "capture" ? CAPTURE_DELAY : 250);
}

async function gotoWithRetry(page, url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (response?.status?.() < 400) return { response };
      lastError = new Error(`HTTP ${response?.status?.()}`);
    } catch (error) {
      lastError = error;
    }
    await page.waitForTimeout(450);
  }
  return { error: lastError };
}

function routeSlug(route) {
  return route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replaceAll("/", "__");
}

function safeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "section";
}

async function makeContext(browser, viewport, reducedMotion = false) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
  });
  await seedConsent(context);
  await context.route(/googletagmanager|google-analytics|doubleclick|facebook|hotjar|clarity/i, (route) =>
    route.abort(),
  );
  return context;
}

async function getAudit(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const docWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const textOf = (el) => (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100);
    const describe = (el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        className: typeof el.className === "string" ? el.className.slice(0, 160) : "",
        text: textOf(el),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const elements = [...document.querySelectorAll("body *")].filter(visible);

    const overflowElements = elements
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.right > viewportWidth + 2 || rect.left < -2;
      })
      .slice(0, 30)
      .map(describe);

    const brokenImages = [...document.images]
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => ({ src: img.currentSrc || img.src, alt: img.alt || "" }));

    const tapSelector = "a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],summary";
    const smallTapTargets = [...document.querySelectorAll(tapSelector)]
      .filter((el) => {
        if (!visible(el)) return false;
        const rect = el.getBoundingClientRect();
        const inViewport = rect.bottom >= 0 && rect.top <= viewportHeight;
        return inViewport && (rect.width < 43.5 || rect.height < 43.5);
      })
      .slice(0, 30)
      .map(describe);

    const clippedText = elements
      .filter((el) => {
        const style = getComputedStyle(el);
        if (!/(hidden|clip|auto|scroll)/.test(`${style.overflow}${style.overflowX}${style.overflowY}`)) return false;
        if (!textOf(el)) return false;
        return el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2;
      })
      .slice(0, 30)
      .map(describe);

    const hiddenRevealCandidates = [...document.querySelectorAll("[data-reveal], [style*='opacity: 0'], [style*='opacity:0']")]
      .filter((el) => {
        if (!visible(el)) return false;
        return Number(getComputedStyle(el).opacity) === 0;
      })
      .slice(0, 30)
      .map(describe);

    const importantSelector = "a[href],button,h1,h2,h3,h4,p,li,blockquote,[data-audit-layer]";
    const occlusions = [...document.querySelectorAll(importantSelector)]
      .filter((el) => visible(el) && textOf(el))
      .flatMap((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > viewportHeight) return [];
        const points = [
          [rect.left + rect.width / 2, rect.top + rect.height / 2],
          [rect.left + Math.min(12, rect.width / 2), rect.top + Math.min(12, rect.height / 2)],
          [rect.right - Math.min(12, rect.width / 2), rect.bottom - Math.min(12, rect.height / 2)],
        ].filter(([x, y]) => x >= 0 && x <= viewportWidth && y >= 0 && y <= viewportHeight);
        for (const [x, y] of points) {
          const top = document.elementFromPoint(x, y);
          if (!top) continue;
          if (el === top || el.contains(top) || top.contains(el)) continue;
          const topRect = top.getBoundingClientRect();
          const topContainsPoint = x >= topRect.left && x <= topRect.right && y >= topRect.top && y <= topRect.bottom;
          const rectsIntersect =
            rect.left < topRect.right &&
            rect.right > topRect.left &&
            rect.top < topRect.bottom &&
            rect.bottom > topRect.top;
          if (!topContainsPoint || !rectsIntersect) continue;
          const topStyle = getComputedStyle(top);
          if (topStyle.pointerEvents === "none") continue;
          return [{ target: describe(el), covering: describe(top), point: [Math.round(x), Math.round(y)] }];
        }
        return [];
      })
      .slice(0, 30);

    const layerConflicts = [...document.querySelectorAll("h1,h2,h3,p,a[href],button,[data-audit-layer]")]
      .filter((el) => visible(el) && textOf(el))
      .flatMap((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > viewportHeight) return [];
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const stack = document.elementsFromPoint(x, y);
        const mediaAbove = stack.find((node) => /^(IMG|VIDEO|CANVAS)$/.test(node.tagName) && !el.contains(node));
        const selfIndex = stack.findIndex((node) => node === el || el.contains(node) || node.contains(el));
        const mediaIndex = mediaAbove ? stack.indexOf(mediaAbove) : -1;
        if (mediaAbove && mediaIndex >= 0 && mediaIndex < selfIndex) {
          return [{ target: describe(el), mediaAbove: describe(mediaAbove), point: [Math.round(x), Math.round(y)] }];
        }
        return [];
      })
      .slice(0, 20);

    function objectPositionY(style) {
      const raw = style.objectPosition || "50% 50%";
      const parts = raw.split(/\s+/);
      const y = parts[1] || parts[0] || "50%";
      if (y === "top") return 0;
      if (y === "bottom") return 1;
      if (y.endsWith("%")) return Number.parseFloat(y) / 100;
      return 0.5;
    }

    const personPattern = /\b(portrait|coach|trainer|raphael|founder|owner|team|person|mann|frau|athlet|athlete)\b/i;
    const personCropRisks = [...document.images]
      .filter((img) => visible(img) && img.naturalWidth > 0 && img.naturalHeight > 0)
      .filter((img) => personPattern.test(`${img.alt || ""} ${img.currentSrc || img.src || ""}`))
      .flatMap((img) => {
        const rect = img.getBoundingClientRect();
        if (rect.top > viewportHeight || rect.bottom < 0) return [];
        const style = getComputedStyle(img);
        if (style.objectFit !== "cover") return [];
        const scale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
        const renderedHeight = img.naturalHeight * scale;
        const cropY = Math.max(0, renderedHeight - rect.height);
        const topCrop = cropY * objectPositionY(style);
        const topCropRatio = topCrop / renderedHeight;
        const riskyThreshold = viewportWidth <= 900 ? 0.08 : 0.22;
        if (topCropRatio < riskyThreshold) return [];
        return [{
          image: describe(img),
          src: img.currentSrc || img.src,
          alt: img.alt || "",
          objectPosition: style.objectPosition,
          topCropRatio: Number(topCropRatio.toFixed(3)),
        }];
      })
      .slice(0, 20);

    return {
      title: document.title,
      viewportWidth,
      docWidth,
      horizontalOverflow: docWidth > viewportWidth + 2,
      overflowElements,
      brokenImages,
      smallTapTargets,
      clippedText,
      hiddenRevealCandidates,
      occlusions,
      layerConflicts,
      personCropRisks,
    };
  });
}

async function sectionCandidates(page) {
  return page.evaluate(
    ({ selectors, limit }) => {
      const visible = (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const candidateElements = selectors.length
        ? selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
        : [
            ...document.querySelectorAll(
              "[data-audit-section], main > section, section[id], section[class], main > div[id], main > div[class]",
            ),
          ];
      const seen = new Set();
      return candidateElements
        .filter((el) => {
          if (seen.has(el)) return false;
          seen.add(el);
          if (!visible(el)) return false;
          const rect = el.getBoundingClientRect();
          return rect.width >= 280 && rect.height >= 160;
        })
        .slice(0, limit)
        .map((el, index) => {
          const id = el.id ? `#${el.id}` : "";
          const audit = el.getAttribute("data-audit-section") || "";
          const heading = el.querySelector("h1,h2,h3")?.textContent?.replace(/\s+/g, " ").trim() || "";
          const className = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
          return {
            index,
            label: audit || id || heading || `${el.tagName.toLowerCase()}${className ? `.${className}` : ""}`,
          };
        });
    },
    { selectors: SECTION_SELECTORS, limit: SECTION_LIMIT },
  );
}

async function scrollToSection(page, sectionIndex, mode) {
  await page.evaluate(
    ({ selectors, limit, sectionIndex, mode }) => {
      const visible = (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const candidateElements = selectors.length
        ? selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
        : [
            ...document.querySelectorAll(
              "[data-audit-section], main > section, section[id], section[class], main > div[id], main > div[class]",
            ),
          ];
      const seen = new Set();
      const sections = candidateElements
        .filter((el) => {
          if (seen.has(el)) return false;
          seen.add(el);
          if (!visible(el)) return false;
          const rect = el.getBoundingClientRect();
          return rect.width >= 280 && rect.height >= 160;
        })
        .slice(0, limit);
      const section = sections[sectionIndex];
      if (!section) return;

      const targetY = Math.max(0, section.getBoundingClientRect().top + window.scrollY - Math.round(window.innerHeight * 0.08));
      if (mode === "direct") {
        window.scrollTo(0, targetY);
        window.dispatchEvent(new Event("scroll"));
        return;
      }

      const approachY = Math.max(0, targetY - Math.round(window.innerHeight * 0.62));
      window.scrollTo(0, approachY);
      window.dispatchEvent(new Event("scroll"));
      window.scrollTo(0, targetY);
      window.dispatchEvent(new Event("scroll"));
    },
    { selectors: SECTION_SELECTORS, limit: SECTION_LIMIT, sectionIndex, mode },
  );
  await page.waitForTimeout(450);
  await settle(page);
}

async function getSectionAudit(page, sectionIndex, label, scrollMode) {
  return page.evaluate(
    ({ selectors, limit, sectionIndex, label, scrollMode }) => {
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      const visible = (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const opacity = Number.parseFloat(style.opacity || "1");
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          opacity > 0.01 &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < viewportHeight &&
          rect.right > 0 &&
          rect.left < viewportWidth
        );
      };
      const describe = (el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || "",
          className: typeof el.className === "string" ? el.className.slice(0, 140) : "",
          text: (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      };
      const intersects = (a, b) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const area = (a, b) => {
        const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return width * height;
      };

      const candidateElements = selectors.length
        ? selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
        : [
            ...document.querySelectorAll(
              "[data-audit-section], main > section, section[id], section[class], main > div[id], main > div[class]",
            ),
          ];
      const seen = new Set();
      const sections = candidateElements
        .filter((el) => {
          if (seen.has(el)) return false;
          seen.add(el);
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width >= 280 && rect.height >= 160;
        })
        .slice(0, limit);
      const section = sections[sectionIndex];
      if (!section) return { index: sectionIndex, label, scrollMode, missing: true };

      const sectionRect = section.getBoundingClientRect();
      const targets = [...section.querySelectorAll("h1,h2,h3,h4,p,blockquote,a[href],button,article,[class*='card'],[class*='panel']")]
        .filter((el) => visible(el))
        .filter((el) => (el.innerText || el.textContent || "").trim() || /^(A|BUTTON|ARTICLE)$/.test(el.tagName))
        .slice(0, 80);

      const overlays = [...document.querySelectorAll("body *")]
        .filter((el) => visible(el) && !section.contains(el))
        .filter((el) => {
          const position = getComputedStyle(el).position;
          return position === "fixed" || position === "sticky";
        })
        .slice(0, 50);

      const overlayCollisions = [];
      for (const target of targets) {
        const targetRect = target.getBoundingClientRect();
        for (const overlay of overlays) {
          const overlayRect = overlay.getBoundingClientRect();
          if (!intersects(targetRect, overlayRect) || area(targetRect, overlayRect) < 64) continue;
          const x = Math.max(0, Math.min(viewportWidth - 1, Math.max(targetRect.left, overlayRect.left) + 4));
          const y = Math.max(0, Math.min(viewportHeight - 1, Math.max(targetRect.top, overlayRect.top) + 4));
          const stack = document.elementsFromPoint(x, y);
          const overlayIndex = stack.indexOf(overlay);
          const targetIndex = stack.findIndex((node) => node === target || target.contains(node) || node.contains(target));
          if (overlayIndex >= 0 && (targetIndex < 0 || overlayIndex < targetIndex)) {
            overlayCollisions.push({
              target: describe(target),
              overlay: describe(overlay),
              overlayPosition: getComputedStyle(overlay).position,
              point: [Math.round(x), Math.round(y)],
            });
          }
        }
      }

      const staticTargets = [...section.querySelectorAll("h1,h2,h3,h4,p,blockquote,dl,table,article,[class*='card'],[class*='panel']")]
        .filter((el) => visible(el))
        .filter((el) => (el.innerText || el.textContent || "").trim())
        .slice(0, 90);
      const staticContentCollisions = [];
      for (let i = 0; i < staticTargets.length; i += 1) {
        for (let j = i + 1; j < staticTargets.length; j += 1) {
          const first = staticTargets[i];
          const second = staticTargets[j];
          if (first.contains(second) || second.contains(first)) continue;

          const firstRect = first.getBoundingClientRect();
          const secondRect = second.getBoundingClientRect();
          if (!intersects(firstRect, secondRect) || area(firstRect, secondRect) < 180) continue;

          const firstStyle = getComputedStyle(first);
          const secondStyle = getComputedStyle(second);
          const firstText = (first.innerText || first.textContent || "").trim();
          const secondText = (second.innerText || second.textContent || "").trim();
          const headingPair = /^H[1-4]$/.test(first.tagName) || /^H[1-4]$/.test(second.tagName);
          const visibleTextPair = firstText.length > 0 && secondText.length > 0;
          const nonDecorative =
            firstStyle.pointerEvents !== "none" &&
            secondStyle.pointerEvents !== "none" &&
            Number.parseFloat(firstStyle.opacity || "1") > 0.08 &&
            Number.parseFloat(secondStyle.opacity || "1") > 0.08;

          if (!visibleTextPair || !nonDecorative) continue;

          const x = Math.round((Math.max(firstRect.left, secondRect.left) + Math.min(firstRect.right, secondRect.right)) / 2);
          const y = Math.round((Math.max(firstRect.top, secondRect.top) + Math.min(firstRect.bottom, secondRect.bottom)) / 2);
          const stack = document.elementsFromPoint(x, y);
          const firstIndex = stack.findIndex((node) => node === first || first.contains(node) || node.contains(first));
          const secondIndex = stack.findIndex((node) => node === second || second.contains(node) || node.contains(second));

          if (headingPair || firstIndex >= 0 || secondIndex >= 0) {
            staticContentCollisions.push({
              first: describe(first),
              second: describe(second),
              point: [x, y],
              reason: headingPair ? "heading-content-overlap" : "content-overlap",
            });
          }
        }
      }

      const clippedText = [...section.querySelectorAll("*")]
        .filter((el) => visible(el))
        .filter((el) => (el.innerText || el.textContent || "").trim())
        .filter((el) => {
          const style = getComputedStyle(el);
          if (!/(hidden|clip|auto|scroll)/.test(`${style.overflow}${style.overflowX}${style.overflowY}`)) return false;
          return el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2;
        })
        .slice(0, 20)
        .map(describe);

      const cookieLayer = [...document.querySelectorAll("[class*='cookie'],[id*='cookie'],[aria-label*='cookie' i]")]
        .filter(visible)
        .filter((el) => {
          const style = getComputedStyle(el);
          return style.position === "fixed" || el.getAttribute("role") === "dialog" || /cookie-layer|cookie-panel/i.test(String(el.className));
        })
        .map(describe)
        .slice(0, 5);

      return {
        index: sectionIndex,
        label,
        scrollMode,
        rect: {
          x: Math.round(sectionRect.x),
          y: Math.round(sectionRect.y),
          width: Math.round(sectionRect.width),
          height: Math.round(sectionRect.height),
        },
        fixedOrStickyOverlayCollisions: overlayCollisions.slice(0, 20),
        staticContentCollisions: staticContentCollisions.slice(0, 20),
        clippedText,
        cookieLayer,
      };
    },
    { selectors: SECTION_SELECTORS, limit: SECTION_LIMIT, sectionIndex, label, scrollMode },
  );
}

async function getSectionAudits(page) {
  if (!SECTION_AUDIT) return [];

  const modes = SECTION_SCROLL_MODE === "both" ? ["natural", "direct"] : [SECTION_SCROLL_MODE];
  const sections = await sectionCandidates(page);
  const audits = [];
  for (const mode of modes) {
    for (const section of sections) {
      await scrollToSection(page, section.index, mode);
      audits.push(await getSectionAudit(page, section.index, section.label, mode));
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return audits;
}

async function runAudit(browser, routes) {
  const results = [];
  for (const viewport of VIEWPORTS) {
    for (const reducedMotion of [false, true]) {
      const context = await makeContext(browser, viewport, reducedMotion);
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on("console", (msg) => {
        if (["error", "warning"].includes(msg.type())) consoleErrors.push(msg.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      for (const route of routes) {
        const url = new URL(route, BASE).toString();
        const { response, error } = await gotoWithRetry(page, url);
        if (error) {
          results.push({ route, viewport: viewport.name, reducedMotion, navigationError: error.message });
          continue;
        }
        await settle(page);
        const audit = await getAudit(page);
        const sectionAudits = await getSectionAudits(page);
        results.push({
          route,
          viewport: viewport.name,
          reducedMotion,
          status: response.status?.() ?? null,
          consoleErrors: [...consoleErrors],
          pageErrors: [...pageErrors],
          sectionAudits,
          ...audit,
        });
        consoleErrors.length = 0;
        pageErrors.length = 0;
      }
      await context.close();
    }
  }
  return results;
}

async function captureSectionScreenshots(page, routeDir, slug, route, viewport, manifest) {
  const sections = await sectionCandidates(page);
  for (const section of sections) {
    await scrollToSection(page, section.index, "natural");
    const file = path.join(routeDir, `${slug}__${viewport.name}__section-${String(section.index).padStart(2, "0")}-${safeName(section.label)}.png`);
    await page.screenshot({ path: file, fullPage: false });
    manifest.push({ route, viewport: viewport.name, type: "section", index: section.index, label: section.label, path: file });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function capture(browser, routes) {
  const root = path.resolve(OUT, `shots${SERIES}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  await mkdir(root, { recursive: true });
  const manifest = [];

  for (const viewport of VIEWPORTS) {
    const context = await makeContext(browser, viewport, process.env.REDUCE === "1");
    const page = await context.newPage();
    for (const route of routes) {
      const slug = routeSlug(route);
      const { error } = await gotoWithRetry(page, new URL(route, BASE).toString());
      if (error) throw error;
      await settle(page);
      const routeDir = path.join(root, slug);
      await mkdir(routeDir, { recursive: true });

      if (CAPTURE_HERO) {
        const file = path.join(routeDir, `${slug}__${viewport.name}__hero.png`);
        await page.screenshot({ path: file, fullPage: false });
        manifest.push({ route, viewport: viewport.name, type: "hero", path: file });
      }
      if (CAPTURE_FULL) {
        const file = path.join(routeDir, `${slug}__${viewport.name}__full.png`);
        await page.screenshot({ path: file, fullPage: true });
        manifest.push({ route, viewport: viewport.name, type: "full", path: file });
      }
      if (CAPTURE_SLICES && viewport.device === "mobile") {
        const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        let index = 0;
        for (let y = 0; y < totalHeight; y += viewport.height) {
          await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
          await page.waitForTimeout(150);
          const file = path.join(routeDir, `${slug}__${viewport.name}__slice-${String(index).padStart(2, "0")}.png`);
          await page.screenshot({ path: file, fullPage: false });
          manifest.push({ route, viewport: viewport.name, type: "slice", index, path: file });
          index += 1;
        }
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      if (CAPTURE_SECTIONS) {
        await captureSectionScreenshots(page, routeDir, slug, route, viewport, manifest);
      }
    }
    await context.close();
  }

  await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
  return { root, count: manifest.length };
}

await mkdir(OUT, { recursive: true });
const routes = await discoverRoutes();
const browser = await launchBrowser();
try {
  if (MODE === "capture") {
    console.log(JSON.stringify(await capture(browser, routes), null, 2));
  } else {
    const results = await runAudit(browser, routes);
    const reportPath = path.resolve(OUT, `audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(reportPath, JSON.stringify(results, null, 2));
    const failures = results.filter((result) =>
      result.navigationError ||
      result.status >= 400 ||
      result.horizontalOverflow ||
      result.brokenImages?.length ||
      result.pageErrors?.length ||
      (result.reducedMotion && result.hiddenRevealCandidates?.length) ||
      result.occlusions?.length ||
      result.layerConflicts?.length ||
      result.personCropRisks?.length ||
      result.sectionAudits?.some((section) =>
        section.fixedOrStickyOverlayCollisions?.length ||
        section.staticContentCollisions?.length ||
        section.cookieLayer?.length,
      ),
    );
    const tapHints = results.filter((result) => result.smallTapTargets?.length);
    console.log(JSON.stringify({ reportPath, resultCount: results.length, failureCount: failures.length, tapHintCount: tapHints.length }, null, 2));
  }
} finally {
  await browser.close();
}
