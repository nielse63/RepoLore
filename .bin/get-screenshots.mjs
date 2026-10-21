import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const viewportWidth = process.env.VIEWPORT_HEIGHT
  ? parseInt(process.env.VIEWPORT_WIDTH)
  : 1512;
const viewportHeight = process.env.VIEWPORT_HEIGHT
  ? parseInt(process.env.VIEWPORT_HEIGHT)
  : 770;

const __dirname = import.meta.dirname;
const baseUrl = "http://localhost:3000";
const repoPath = "lore/nielse63/RepoLore";
const defaultPages = [
  "",
  repoPath,
  `${repoPath}/architecture`,
  `${repoPath}/history`,
  `${repoPath}/systems`,
  `${repoPath}/data-flow`,
  `${repoPath}/dependencies`,
];
const pages = process.env.PAGES.split(",").filter(Boolean) || defaultPages;

const screenshotsDir = path.join(__dirname, "screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir);
}

const browser = await chromium.launch();

const gotoPage = async (pageName = "") => {
  const url = `${baseUrl}/${pageName}`;
  const fileBasename = pageName.replace(/\//g, "-").replace(/^-/, "") || "home";
  const filename = `${fileBasename}.png`;
  const page = await browser.newPage({
    viewport: { width: viewportWidth, height: viewportHeight },
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({
    path: path.join(screenshotsDir, filename),
    fullPage: true,
  });

  console.log(`Screenshot saved to ${filename}`);
};

const main = async () => {
  try {
    await Promise.all(pages.map(gotoPage));
  } finally {
    await browser.close();
  }
};

main().catch(console.error);
