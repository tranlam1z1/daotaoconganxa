const { chromium } = require('playwright-core');
const fs = require('node:fs');

// Read-only smoke checks: no account creation, form submission or database edits.
async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  const results = [];
  const routes = ['/', '/tra-cuu', '/tim-kiem', '/dich-vu-cong', '/cong-cu', '/cong-cu/xac-dinh-tuoi', '/cong-cu/nong-do-con', '/cong-cu/tinh-qua-tai', '/cong-cu/loai-gplx', '/cong-cu/qua-kho-hang-hoa', '/cong-cu/coi-noi-thanh-thung', '/cong-cu/tinh-ngay-xu-ly', '/cong-cu/do-dac-dien-tu', '/cong-cu/dia-gioi', '/hoc', '/luyen-tap', '/thi', '/nhom', '/huong-dan', '/dang-nhap', '/dang-ky', '/tai-khoan', '/quan-tri', '/khong-co-trang-nay'];
  for (const width of [375, 390, 768, 1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const response = await page.goto(`${process.env.UI_BASE_URL || 'http://127.0.0.1:3392'}${route}`, { waitUntil: 'networkidle' });
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        heading: document.querySelector('h1')?.textContent,
        font: getComputedStyle(document.body).fontFamily,
        primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
      }));
      results.push({ width, route, finalPath: new URL(page.url()).pathname, status: response.status(), ...layout });
      if (['/', '/dang-nhap', '/cong-cu/xac-dinh-tuoi', '/khong-co-trang-nay'].includes(route)) {
        await page.screenshot({ path: `outputs/ui-review/${width}-${route === '/' ? 'home' : route.split('/').pop()}.png`, fullPage: true });
      }
    }
  }
  fs.writeFileSync('outputs/ui-review/layout-results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ checks: results.length, overflow: results.filter(r => r.overflow), serverErrors: results.filter(r => r.status >= 500) }, null, 2));
  if (results.some(r => r.overflow || r.status >= 500)) process.exitCode = 1;
  await browser.close();
}
main().catch(e => { console.error(e); process.exitCode = 1; });
