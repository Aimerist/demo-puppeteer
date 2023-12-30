const puppeteer = require("puppeteer");
const fs = require("node:fs");
const outputPath = "./Book";

(async () => {
  // 啟動瀏覽器並開啟一個新的空白頁面
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 800, height: 1200 },
  });
  const page = await browser.newPage();

  // 將頁面導航至 URL
  await page.goto("https://www.8book.com/novelbooks/194239/");

  // 取得章節資訊
  const chapters = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".episode_li")).map((dom) => ({
      title: dom.textContent.replace(/\n/g, "").trim(),
      link: dom.href,
    }));
  });

  const chapter = chapters[0];

  // 取得文章內容，並去除雜訊
  await page.goto(chapter.link);
  const textSelector = await page.waitForSelector("#text");
  const text = await textSelector?.evaluate((el) =>
    el.textContent
      .replace(/　　/g, "\r\n")
      .replace(/“/g, "「")
      .replace(/”/g, "」")
      .trim()
  );

  // 將文章內下儲存至txt
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }
  fs.writeFileSync(`${outputPath}/${chapter.title}.txt`, text);

  // 關閉
  await page.close();
  await browser.close();
})();
