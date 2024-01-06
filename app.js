const puppeteer = require("puppeteer");
const fs = require("node:fs");
const outputPath = "./Book"; // TODO: 重構時，改命名 folderPath
const bookUrl = "https://www.8book.com/novelbooks/194239/";

(async () => {
  // 啟動瀏覽器並開啟一個新的空白頁面
  const { page, browser } = await startBrowser();

  // 取得章節清單
  const chapters = await getChapterList(page, bookUrl);
  let chapterBeginNum = 0;
  const chapterEndNum = chapters.length;

  // 1. 判斷是否有 Book 資料夾
  if (fs.existsSync(outputPath)) {
    // 2. 取得資料夾內所有檔案的名稱
    const files = fs.readdirSync(outputPath);

    // 3. 針對檔案名稱，取得最大數的章節序號
    const fileMaxNum = files
      .map((filename) => {
        const match = filename.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .reduce((max, num) => Math.max(max, num), 0);
    chapterBeginNum = fileMaxNum ? fileMaxNum - 1 : 0;

    // 4. 刪除最大數的章節序號
    const deleteFilePath = `${outputPath}/Chapter_${fileMaxNum}.txt`;
    try {
      fs.unlinkSync(deleteFilePath);
      console.log(`刪除 ${deleteFilePath} 檔案`);
    } catch (err) {
      console.error(`查無 ${deleteFilePath} 檔案`);
    }
  } else {
    fs.mkdirSync(outputPath);
    console.log(`建立 Book 資料夾`);
    chapterBeginNum = 0;
  }

  for (let i = chapterBeginNum; i < chapterEndNum; i++) {
    const { url: chapterUrl } = chapters[i];
    const chapterTitle = `Chapter_${i + 1}`;

    const article = await getArticle(page, chapterUrl);
    saveArticle(chapterTitle, article);

    // 同章節，下一頁的內容
    const hasNextButton = async () => {
      try {
        const nextButtonSelector = await page.waitForSelector("#npbt", {
          timeout: 1000,
        });
        return nextButtonSelector ? true : false;
      } catch (e) {
        if (e instanceof puppeteer.TimeoutError) {
          // console.log(`Oops! ${chapterTitle}, Next page button is not found!`);
          return false;
        }
      }
    };

    while (await hasNextButton()) {
      const nextButtonSelector = await page.waitForSelector("#npbt");
      const nextUrl = await nextButtonSelector.evaluate((el) => el.href);
      const article = await getArticle(page, nextUrl);
      saveArticle(chapterTitle, article);
    }
    console.log(`${chapterTitle} is Done!`);
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
  await page.goto(chapterUrl, { waitUntil: "networkidle2" });
  // TODO: 官方文件已移出，問題參考 https://www.jianshu.com/p/31375cae68d1
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
  fs.writeFileSync(`${outputPath}/${title}.txt`, article, { flag: "a+" });
}
