const puppeteer = require("puppeteer");
const fs = require("node:fs");
const { exec } = require("child_process");
const folderPath = "./Book";
const bookUrl = "https://www.8book.com/novelbooks/194239/";
const bookName = "神隱";

(async () => {
  // 啟動瀏覽器並開啟一個新的空白頁面
  const { page, browser } = await startBrowser();

  // 取得章節清單
  const chapters = await getChapterList(page);
  let chapterBeginNum = 0;
  const chapterEndNum = chapters.length;

  // 防呆機制 - 判斷是否有 Book 資料夾
  if (fs.existsSync(folderPath)) {
    // 2. 取得資料夾內所有檔案的名稱
    const filenames = fs.readdirSync(folderPath);

    // 3. 針對檔案名稱，取得最大數的章節序號
    const filenameMaxNum = filenames
      .map((filename) => {
        const match = filename.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .reduce((max, num) => Math.max(max, num), 0);
    chapterBeginNum = filenameMaxNum ? filenameMaxNum - 1 : 0;

    // 4. 刪除最大數的章節序號
    const deleteFilePath = `${folderPath}/Chapter_${filenameMaxNum}.html`;
    try {
      fs.unlinkSync(deleteFilePath);
      console.log(`刪除 ${deleteFilePath} 檔案`);
    } catch (err) {
      console.error(`查無 ${deleteFilePath} 檔案`);
    }
  } else {
    fs.mkdirSync(folderPath);
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

  // 將各章節檔案轉換成 Epub 電子書格式
  conventEpubWithTerminal();

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
  await page.goto(bookUrl);

  return { page, browser };
}

// 取得章節目錄
async function getChapterList(page) {
  const chapters = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".episode_li")).map((dom) => ({
      title: dom.textContent.replace(/\n/g, "").trim(),
      url: dom.href,
    }));
  });
  return chapters;
}

// 取得文章內容
async function getArticle(page, chapterUrl) {
  await page.goto(chapterUrl, { waitUntil: "networkidle2" });
  // TODO: 官方文件已移出，問題參考 https://www.jianshu.com/p/31375cae68d1
  const contentSelector = await page.waitForSelector("#text");
  const content = await contentSelector?.evaluate((el) =>
    el.textContent
      .replace(/第(\S+)章/, "<h1>第$1章</h1>")
      .replace(/(?!^)　　/g, "<br /><br />")
      .replace(/“/g, "「")
      .replace(/”/g, "」")
      .replace(/window._[\s\S]+?}\);/g, "")
      .trim()
  );
  return content;
}

// 儲存文章
function saveArticle(title, article) {
  fs.writeFileSync(`${folderPath}/${title}.html`, article, { flag: "a+" });
}

// 將各章節檔案轉換成 Epub 電子書格式
function conventEpubWithTerminal() {
  const ePubBook = `${bookName}.epub`;
  if (fs.existsSync(`${folderPath}/${ePubBook}`)) {
    fs.unlinkSync(`${folderPath}/${ePubBook}`);
  }
  fs.writeFileSync(
    `${folderPath}/Chapter_0.html`,
    `<head><title>${bookName}</title></head>`
  );

  const filenames = fs.readdirSync(folderPath);
  const goFolderCommand = `cd ${__dirname} && cd ${folderPath}`;
  const pandocCommand = `pandoc -f html -t epub3 -o ${ePubBook}`;
  const combinedFilenames = filenames
    .sort((a, b) => {
      const numberA = parseInt(a.match(/\d+/)[0], 10);
      const numberB = parseInt(b.match(/\d+/)[0], 10);
      return numberA - numberB;
    })
    .join(" ");

  exec(
    `${goFolderCommand} && ${pandocCommand} ${combinedFilenames}`,
    (error, stderr, stdout) => {
      if (error) {
        console.log(`error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
      }
      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }
    }
  );
}
