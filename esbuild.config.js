const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const isWatch = process.argv.includes("--watch");

// Build plugin code (runs in Figma sandbox - NO DOM APIs)
// Figma uses an older JS engine, avoid object spread
const codeConfig = {
  entryPoints: ["src/code.ts"],
  bundle: true,
  outfile: "dist/code.js",
  target: ["es2017"],
  format: "iife",
  minify: false,
  sourcemap: isWatch ? "inline" : false,
};

// Build UI code (runs in iframe - has DOM APIs)
// We write to a temp file then inline it into HTML
const uiConfig = {
  entryPoints: ["src/ui/index.tsx"],
  bundle: true,
  write: false,
  target: "es2017",
  format: "iife",
  minify: !isWatch,
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
    ".css": "text",
  },
  define: {
    "process.env.NODE_ENV": isWatch ? '"development"' : '"production"',
  },
};

function generateHtml(jsCode, cssCode) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DS Bridge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      color: #333;
      background: #fff;
    }
    ${cssCode}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>${jsCode}</script>
</body>
</html>`;
}

async function build() {
  try {
    // Ensure dist directory exists
    if (!fs.existsSync("dist")) {
      fs.mkdirSync("dist");
    }

    // Build main plugin code
    await esbuild.build(codeConfig);
    console.log("✓ Built code.js");

    // Build UI and get the output
    const uiResult = await esbuild.build(uiConfig);
    const jsCode = uiResult.outputFiles[0].text;
    
    // Read CSS file
    let cssCode = "";
    try {
      cssCode = fs.readFileSync("src/ui/styles.css", "utf8");
    } catch (e) {
      console.log("No styles.css found, continuing without styles");
    }

    // Generate HTML with inlined JS and CSS
    const html = generateHtml(jsCode, cssCode);
    fs.writeFileSync("dist/ui.html", html);
    console.log("✓ Generated ui.html with inlined JS");

    if (isWatch) {
      console.log("👀 Watch mode not fully supported, run build again after changes");
    }
    
    console.log("✓ Build complete");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
