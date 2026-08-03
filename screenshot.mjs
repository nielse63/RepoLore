import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

await page.goto("http://localhost:3000/lore/nielse63/RepoLore", {
  waitUntil: "networkidle",
});

await page.screenshot({
  path: "repo-lore-overview.png",
  fullPage: true,
});

await browser.close();

console.log("Saved repo-lore-overview.png");
