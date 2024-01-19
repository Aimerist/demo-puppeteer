const puppeteer = require("puppeteer");
const fs = require("node:fs");
const { exec } = require("child_process");
const bookUrl = "https://www.8book.com/novelbooks/194239/";
const bookName = "神隱";
const folderPath = "./DemoBook";

/* 
1. 取得章節目錄（章節名稱、連結）
2. 利用章節目錄的連結，進入每個章節
    A. 取得文章內容
    B. 儲存文章內容
    C. 判斷是否有下一頁
        C1. 如果有，就進入下一頁做 A.B.C.
        C2. 如果沒有，就結束這一張進入下一章節
3. 防呆機制：避免爬蟲中斷後，可以接續之前的階段繼續進行。
    - 判斷有 Book 資料夾
      A. 取得資料夾內所有檔案的名稱
      B. 針對檔案名稱，取得最大數的章節序號
      C. 刪除最大數的章節序號
    - 判斷沒有 Book 資料夾
      A. 建立 Book 資料夾
4. 轉成 EPub 電子書格式
*/

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(bookUrl);

  await page.close();
  await browser.close();
})();

/* 1.取得章節目錄（章節名稱、連結）*/
const chapters = await page.evaluate(() => {
  return Array.from(document.querySelectorAll(".episode_li")).map((dom) => ({
    title: dom.textContent.replace(/\n/g, "").trim(),
    url: dom.href,
  }));
});

let chapterBeginNum = 0;
const chapterEndNum = 3; // chapters.length;
/* 2.利用章節目錄的連結，進入每個章節 */
for (let i = chapterBeginNum; i < chapterEndNum; i++) {
  const chapterTitle = `Chapter_${i + 1}`;
}

/* A. 取得文章內容 */
await page.goto(chapters[i].url); // options:{ waitUntil: "networkidle2" }
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

/* B. 儲存文章內容 */
fs.writeFileSync(`${folderPath}/${chapterTitle}.html`, content, {
  flag: "a+",
});

/* C-1. 如果有，就進入下一頁做 A.B.C. */
while (await hasNextButton()) {
  const nextButtonSelector = await page.waitForSelector("#npbt");
  const nextUrl = await nextButtonSelector.evaluate((el) => el.href);

  /* A.B. 存、取文章內容 */
  const article = await getArticle(page, nextUrl);
  saveArticle(chapterTitle, article);
}
/* C-2. 如果沒有，就結束這一張進入下一章節 */
console.log(`${chapterTitle} is Done!`);

/* C. 判斷是否有下一頁 */
const hasNextButton = async () => {
  try {
    const nextButtonSelector = await page.waitForSelector("#npbt", {
      timeout: 1000,
    });
    return nextButtonSelector ? true : false;
  } catch (error) {
    if (error instanceof puppeteer.TimeoutError) {
      return false;
    } else {
      console.log(`Oops! ${error}`);
    }
  }
};

/* 3. 防呆機制：避免爬蟲中斷後，可以接續之前的階段繼續進行。*/
if (fs.existsSync(folderPath)) {
  /* A. 取得資料夾內所有檔案的名稱 */
  const filenames = fs.readdirSync(folderPath);

  /* B. 針對檔案名稱，取得最大數的章節序號 */
  const filenameMaxNum = filenames
    .map((filename) => {
      const match = filename.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    })
    .reduce((max, num) => Math.max(max, num), 0);
  chapterBeginNum = filenameMaxNum ? filenameMaxNum - 1 : 0;

  /* C. 刪除最大數的章節序號 */
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

/* 4. 轉成 Epub 電子書格式 */
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
