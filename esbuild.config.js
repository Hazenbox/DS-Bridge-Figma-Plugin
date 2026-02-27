const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const isWatch = process.argv.includes("--watch");

// Build plugin code (runs in Figma sandbox - NO DOM APIs)
const codeConfig = {
  entryPoints: ["src/code.ts"],
  bundle: true,
  outfile: "dist/code.js",
  target: "es2020",
  format: "iife",
  minify: !isWatch,
  sourcemap: isWatch ? "inline" : false,
};

// Build UI code (runs in iframe - has DOM APIs)
const uiConfig = {
  entryPoints: ["src/ui/index.tsx"],
  bundle: true,
  outfile: "dist/ui.js",
  target: "es2020",
  format: "iife",
  minify: !isWatch,
  sourcemap: isWatch ? "inline" : false,
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
    ".css": "css",
  },
  define: {
    "process.env.NODE_ENV": isWatch ? '"development"' : '"production"',
  },
};

// HTML template for UI
const htmlTemplate = `<!DOCTYPE html>
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
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="ui.js"></script>
</body>
</html>`;

async function build() {
  try {
    // Ensure dist directory exists
    if (!fs.existsSync("dist")) {
      fs.mkdirSync("dist");
    }

    // Write HTML file
    fs.writeFileSync("dist/ui.html", htmlTemplate);
    console.log("✓ Generated ui.html");

    if (isWatch) {
      // Watch mode
      const codeCtx = await esbuild.context(codeConfig);
      const uiCtx = await esbuild.context(uiConfig);

      await Promise.all([codeCtx.watch(), uiCtx.watch()]);
      console.log("👀 Watching for changes...");
    } else {
      // Single build
      await Promise.all([esbuild.build(codeConfig), esbuild.build(uiConfig)]);
      console.log("✓ Build complete");
    }
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
