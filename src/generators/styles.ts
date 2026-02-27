/**
 * STYLE GENERATORS
 *
 * Creates Figma Text Styles and Effect Styles from exported JSON.
 */

import type { FigmaPluginTextStyle, FigmaPluginEffectStyle } from "../types/schema";

/**
 * Create text styles
 */
export async function createTextStyles(
  textStyles: FigmaPluginTextStyle[]
): Promise<void> {
  for (const styleDef of textStyles) {
    try {
      // Load font first (CRITICAL - must happen before setting properties)
      await figma.loadFontAsync({
        family: styleDef.fontFamily,
        style: styleDef.fontStyle,
      });

      // Create style
      const style = figma.createTextStyle();
      style.name = styleDef.name;

      // Set font
      style.fontName = {
        family: styleDef.fontFamily,
        style: styleDef.fontStyle,
      };

      // Set size
      style.fontSize = styleDef.fontSize;

      // Set line height
      if (styleDef.lineHeight === "AUTO") {
        style.lineHeight = { unit: "AUTO" };
      } else {
        style.lineHeight = { unit: "PIXELS", value: styleDef.lineHeight };
      }

      // Set letter spacing
      style.letterSpacing = { unit: "PIXELS", value: styleDef.letterSpacing };

      // Set text case
      if (styleDef.textCase) {
        style.textCase = styleDef.textCase;
      }

      // Set text decoration
      if (styleDef.textDecoration) {
        style.textDecoration = styleDef.textDecoration;
      }

      // Set paragraph spacing
      if (styleDef.paragraphSpacing !== undefined) {
        style.paragraphSpacing = styleDef.paragraphSpacing;
      }

      // Set paragraph indent
      if (styleDef.paragraphIndent !== undefined) {
        style.paragraphIndent = styleDef.paragraphIndent;
      }

      // Yield to prevent UI freezing
      await delay(5);
    } catch (error) {
      console.error(`Failed to create text style "${styleDef.name}":`, error);
      // Continue with other styles even if one fails
    }
  }
}

/**
 * Create effect styles
 */
export async function createEffectStyles(
  effectStyles: FigmaPluginEffectStyle[]
): Promise<void> {
  for (const styleDef of effectStyles) {
    try {
      const style = figma.createEffectStyle();
      style.name = styleDef.name;

      // Map effects
      const effects: Effect[] = styleDef.effects.map((effect) => {
        if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
          return {
            type: effect.type,
            color: effect.color || { r: 0, g: 0, b: 0, a: 0.1 },
            offset: effect.offset || { x: 0, y: 0 },
            radius: effect.radius,
            spread: effect.spread || 0,
            visible: effect.visible,
            blendMode: "NORMAL" as BlendMode,
          };
        } else if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
          return {
            type: effect.type,
            radius: effect.radius,
            visible: effect.visible,
          };
        }

        // Fallback to drop shadow
        return {
          type: "DROP_SHADOW" as const,
          color: { r: 0, g: 0, b: 0, a: 0.1 },
          offset: { x: 0, y: 2 },
          radius: effect.radius,
          spread: 0,
          visible: effect.visible,
          blendMode: "NORMAL" as BlendMode,
        };
      });

      style.effects = effects;

      // Yield to prevent UI freezing
      await delay(5);
    } catch (error) {
      console.error(`Failed to create effect style "${styleDef.name}":`, error);
    }
  }
}

/**
 * Small delay to yield to Figma UI
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
