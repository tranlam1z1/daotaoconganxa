import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
const results = [];
for (const [width, height, name] of [
  [1440, 900, "desktop"],
  [390, 844, "mobile"],
  [320, 740, "narrow"],
] as const) {
  await page.setViewportSize({ width, height });
  await page.goto("http://localhost:3030/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `docs/ui-brand-review/${name}.png`, fullPage: true });
  results.push(
    await page.evaluate(() => ({
      viewport: `${innerWidth}x${innerHeight}`,
      overflow: document.documentElement.scrollWidth > innerWidth,
      heading: document.querySelector("h1")?.textContent,
      links: [...document.querySelectorAll('section[aria-labelledby="loi-vao-tieu-de"] a')].map((a) =>
        a.getAttribute("href"),
      ),
    })),
  );
}
await page.keyboard.press("Tab");
console.log(
  JSON.stringify(
    {
      results,
      focus: await page.evaluate(() => ({
        text: document.activeElement?.textContent,
        outline: getComputedStyle(document.activeElement!).outlineStyle,
      })),
    },
    null,
    2,
  ),
);
await browser.close();
