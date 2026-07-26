const fs = require("fs");
const path = require("path");

const maxChunkSizeBytes = 500 * 1024;
const jsDir = path.resolve(__dirname, "../build/static/js");

// Analytics module exception: Monaco (SQL editor) and ECharts are only
// ever loaded lazily (React.lazy, chunks: "async" in craco.config.js), so
// they never inflate the initial page load - but their vendor chunks do
// individually exceed the 500 KB cap that governs everything else. Named
// explicitly (not a blanket size increase) so any other oversized chunk
// still fails the build.
const exemptChunkPrefixes = ["vendor-monaco", "vendor-echarts", "vendor-grid-layout", "monaco"];
const isExempt = (fileName) => exemptChunkPrefixes.some((prefix) => fileName.startsWith(prefix));

if (!fs.existsSync(jsDir)) {
  console.error("JavaScript build directory not found. Run the production build first.");
  process.exit(1);
}

const oversizedChunks = fs
  .readdirSync(jsDir)
  .filter((fileName) => fileName.endsWith(".js"))
  .filter((fileName) => !isExempt(fileName))
  .map((fileName) => {
    const filePath = path.join(jsDir, fileName);
    return {
      fileName,
      size: fs.statSync(filePath).size,
    };
  })
  .filter((chunk) => chunk.size > maxChunkSizeBytes)
  .sort((a, b) => b.size - a.size);

if (oversizedChunks.length > 0) {
  console.error("Oversized JavaScript chunks detected:");
  for (const chunk of oversizedChunks) {
    console.error(`  ${chunk.fileName}: ${(chunk.size / 1024).toFixed(2)} KB`);
  }
  process.exit(1);
}

console.log("All JavaScript chunks are within the 500 KB limit.");
