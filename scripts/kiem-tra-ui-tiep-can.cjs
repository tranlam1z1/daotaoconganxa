const { chromium } = require('playwright-core');
const fs = require('node:fs');

async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(`${process.env.UI_BASE_URL || 'http://127.0.0.1:3392'}/dang-nhap`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const skip = await page.evaluate(() => ({ text: document.activeElement.textContent, outline: getComputedStyle(document.activeElement).outlineStyle }));
  await page.keyboard.press('Enter');
  const skipTarget = await page.evaluate(() => document.activeElement.id);
  await page.locator('#ten-dang-nhap').focus();
  const focus = await page.locator('#ten-dang-nhap').evaluate(e => ({ outline: getComputedStyle(e).outlineStyle, label: e.labels[0]?.textContent, valid: e.checkValidity(), height: e.getBoundingClientRect().height }));
  const modes = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
    modes.push(await page.evaluate(theme => {
      const style = getComputedStyle(document.documentElement);
      const luminance = hex => {
        let h = hex.replace('#', '');
        if (h.length === 3) h = [...h].map(c => c + c).join('');
        return h.match(/../g).map(x => parseInt(x, 16) / 255)
          .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
          .reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
      };
      const get = key => style.getPropertyValue(key).trim();
      const pairs = [['body', '--ink', '--surface'], ['secondary text', '--ink-3', '--surface'], ['button', '--on-primary', '--primary'], ['navigation', '--secondary', '--secondary-soft'], ['warning', '--warn', '--warn-soft'], ['success', '--ok', '--ok-soft'], ['error', '--danger', '--danger-soft']].map(([name, a, b]) => {
        const x = luminance(get(a)), y = luminance(get(b));
        return { name, foreground: get(a), background: get(b), contrast: +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2) };
      });
      return { theme, pairs };
    }, theme));
    await page.screenshot({ path: `outputs/ui-review/390-login-${theme}.png`, fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const data = { skip, skipTarget, focus, modes, reducedMotion, limits: 'Token contrast only; no authenticated writes or protected content inspected.' };
  fs.writeFileSync('outputs/ui-review/accessibility-results.json', JSON.stringify(data, null, 2));
  console.log(JSON.stringify(data, null, 2));
  if (skipTarget !== 'noi-dung-chinh' || focus.outline === 'none' || focus.height < 44 || !focus.label || modes.some(m => m.pairs.some(p => !Number.isFinite(p.contrast) || p.contrast < 4.5))) process.exitCode = 1;
  await browser.close();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
