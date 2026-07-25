const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const buildDir = path.resolve(__dirname, "../build");
const compressibleExtensions = new Set([".js", ".css", ".html", ".svg"]);

function gzipFile(filePath) {
  const gzipPath = `${filePath}.gz`;
  const source = fs.readFileSync(filePath);
  const compressed = zlib.gzipSync(source, { level: 9 });

  if (fs.existsSync(gzipPath)) {
    const current = fs.readFileSync(gzipPath);
    if (current.length <= compressed.length) {
      return;
    }
  }

  fs.writeFileSync(gzipPath, compressed);
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(entryPath);
      continue;
    }

    if (compressibleExtensions.has(path.extname(entry.name)) && !entry.name.endsWith(".gz")) {
      gzipFile(entryPath);
    }
  }
}

if (!fs.existsSync(buildDir)) {
  console.error("Build directory not found. Run the production build first.");
  process.exit(1);
}

walk(buildDir);
console.log("Compressed production assets with gzip.");
