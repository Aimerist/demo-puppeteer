const puppeteer = require("puppeteer");

(async () => {
  // 啟動瀏覽器並開啟一個新的空白頁面
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 800, height: 1200 },
  });
  const page = await browser.newPage();

  // 將頁面導航至 URL
  await page.goto("https://www.8book.com/novelbooks/194239/");

  const chapters = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".episode_li")).map((dom) => ({
      title: dom.textContent.replace(/\n/g, "").trim(),
      link: dom.href,
    }));
  });

  await page.goto(chapters[0].link);

  const textSelector = await page.waitForSelector("#text");
  const text = await textSelector?.evaluate((el) => el.textContent);
  console.log(text);
})();
