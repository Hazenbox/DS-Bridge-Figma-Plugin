# DS Bridge - Figma Plugin

A Figma plugin that imports design tokens and creates components from Rivers DS.

## Features

- **Variables**: Import density tokens, colors, and spacing as Figma Variables with mode support
- **Components**: Create component sets with all variants (e.g., Button with Primary/Secondary/Ghost × SM/MD/LG)
- **Text Styles**: Generate typography styles (Heading, Body, Label, Code)
- **Effect Styles**: Create shadow presets (XS, SM, MD, LG, XL)

## Installation

### For Development

1. Clone this repository:
   ```bash
   git clone https://github.com/Hazenbox/DS-Bridge-Figma-Plugin.git
   cd DS-Bridge-Figma-Plugin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. In Figma Desktop:
   - Go to **Plugins > Development > Import plugin from manifest...**
   - Select the `manifest.json` file from this directory

### For Development (Watch Mode)

```bash
npm run dev
```

This will watch for changes and rebuild automatically.

## Usage

1. In Rivers DS, go to the Component Editor
2. Click **"Export for Figma"** button in the sidebar
3. Save the JSON file
4. In Figma, run the DS Bridge plugin
5. Upload the JSON file
6. Click **"Import to Figma"**

## Export JSON Format

The plugin expects a JSON file with this structure:

```json
{
  "version": "1.0.0",
  "source": "rivers-ds",
  "exportedAt": "2026-02-27T...",
  "variableCollections": [...],
  "components": [...],
  "textStyles": [...],
  "effectStyles": [...]
}
```

## Variable Collections

The plugin creates two main collections:

### Density
Modes: Compact, Default, Spacious

Variables include:
- Control heights (control-height, control-height-sm, control-height-lg)
- Spacing (stack-gap, section-gap, inline-gap)
- Insets (inset-xs through inset-xl)
- Border radius (radius-sm through radius-xl)
- Icon sizes

### Colors
Modes: Light, Dark

Variables include:
- Primary/Secondary/Accent colors
- Background/Foreground colors
- Semantic colors (success, warning, info)

## Limitations

- **Mode Limits**: Free Figma accounts support 1 mode, Pro supports 4 modes
- **Fonts**: Text styles require fonts to be available in Figma (defaults to Inter)
- **No Bi-directional Sync**: Changes in Figma are not synced back to Rivers DS

## Development

### Project Structure

```
DS-Bridge-Figma-Plugin/
├── manifest.json       # Figma plugin configuration
├── package.json        # Node dependencies
├── tsconfig.json       # TypeScript configuration
├── esbuild.config.js   # Build configuration
├── src/
│   ├── code.ts         # Main plugin code (Figma sandbox)
│   ├── ui/             # React UI (iframe)
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   └── styles.css
│   ├── generators/     # Figma API generators
│   │   ├── variables.ts
│   │   ├── components.ts
│   │   └── styles.ts
│   ├── types/          # TypeScript types
│   │   └── schema.ts
│   └── utils/          # Utilities
│       └── colors.ts
└── dist/               # Build output
```

### Type Checking

```bash
npm run typecheck
```

## License

MIT
