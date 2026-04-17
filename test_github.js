const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.on("console", msg => console.log("LOG:", msg.text()));
  page.on("pageerror", error => console.log("ERROR:", error.message));
  await page.goto("https://fredm777.github.io/studio_pro/");
  await new Promise(r => setTimeout(r, 5000)); // Wait for anything to load
  await browser.close();
})();
