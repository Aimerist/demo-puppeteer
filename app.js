const puppeteer = require("puppeteer");
const fs = require("node:fs");
const outputPath = "./Book";
const bookUrl = "https://www.8book.com/novelbooks/194239/";

(async () => {
  // 啟動瀏覽器並開啟一個新的空白頁面
  const { page, browser } = await startBrowser();

  // 取得章節清單
  const chapters = await getChapterList(page, bookUrl);

  for (let i = 0; i < 1; i++) {
    const { title: chapterTitle, url: chapterUrl } = chapters[i];

    // 取得文章內容，並去除雜訊
    const text = await getArticle(page, chapterUrl);

    // 儲存文章
    saveArticle(chapterTitle, text);
  }

  // 關閉
  await page.close();
  await browser.close();
})();

// 啟動瀏覽器
async function startBrowser() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 800, height: 1200 },
  });
  const page = await browser.newPage();
  return { page, browser };
}

// 取得章節目錄
async function getChapterList(page, bookUrl) {
  await page.goto(bookUrl);

  const chapters = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".episode_li")).map((dom) => ({
      title: dom.textContent.replace(/\n/g, "").trim(),
      url: dom.href,
    }));
  });
  return chapters;
}

// 取得文章
async function getArticle(page, chapterUrl) {
  await page.goto(chapterUrl);
  const contentSelector = await page.waitForSelector("#text");
  const content = await contentSelector?.evaluate((el) =>
    el.textContent
      .replace(/　　/g, "\r\n")
      .replace(/“/g, "「")
      .replace(/”/g, "」")
      .trim()
  );
  return content;
}

// 儲存文章
function saveArticle(title, article) {
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }
  fs.writeFileSync(`${outputPath}/${title}.txt`, article);
}
