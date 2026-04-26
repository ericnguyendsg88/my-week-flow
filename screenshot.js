const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/mac/.gemini/antigravity/brain/6ffb7412-f24d-439d-b492-9e81a55249d8/screenshot_verify.png' });
  await browser.close();
})();
