const puppeteer = require("puppeteer");

(async () => {
  // 啟動瀏覽器並開啟一個新的空白頁面
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 },
  });
  const page = await browser.newPage();

  // 前往指定URL
  await page.goto("https://developer.chrome.com/");

  // 在欄位，輸入文字 "js-text"
  await page.type(".devsite-search-field", "js-text");

  // 操控鍵盤 "Enter"
  await page.keyboard.press("Enter");

  // 等待元素，出現在頁面中
  await page.waitForSelector("a.gs-title");

  // 點擊元素
  await page.click("a.gs-title");

  // 在瀏覽器執行 JavaScript，列印頁面尺寸資訊
  await page.evaluate(() => {
    console.log("width:", document.documentElement.clientWidth);
    console.log("height:", document.documentElement.clientHeight);
  });

  // 畫面截圖
  await page.screenshot({ path: "example.png" });

  // // 回到上一頁
  // await page.goBack();
  // // 前進下一頁
  // await page.goForward();
  // // 重新整理
  // await page.reload();

  await page.close();
  await browser.close();
})();
