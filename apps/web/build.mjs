import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync, statSync } from "fs";
import { minify } from "html-minifier-terser";

mkdirSync("out", { recursive: true });

const sourceHtml = readFileSync("src/index.html", "utf8");
const minifiedHtml = await minify(sourceHtml, {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  minifyJS: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
});

writeFileSync("out/index.html", minifiedHtml, "utf8");
if (existsSync("src/favicon.ico")) copyFileSync("src/favicon.ico", "out/favicon.ico");

const originalBytes = statSync("src/index.html").size;
const builtBytes = statSync("out/index.html").size;
const savedBytes = originalBytes - builtBytes;
const savedPercent = ((savedBytes / originalBytes) * 100).toFixed(1);

console.log(`Built to out/ (${builtBytes} bytes, -${savedBytes} bytes / ${savedPercent}%)`);
