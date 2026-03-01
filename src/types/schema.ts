/**
 * FIGMA PLUGIN IMPORT SCHEMA
 *
 * Types matching the export from Rivers DS.
 * This file is kept in sync with Rivers DS schema.
 */

// ============================================
// MAIN EXPORT INTERFACE
// ============================================

export interface FigmaPluginExport {
  version: "1.0.0";
  exportedAt: string;
  source: "rivers-ds";
  variableCollections: FigmaPluginVariableCollection[];
  components: FigmaPluginComponent[];
  textStyles?: FigmaPluginTextStyle[];
  effectStyles?: FigmaPluginEffectStyle[];
  codeConnect?: FigmaPluginCodeConnect[];
}

// ============================================
// VARIABLE COLLECTIONS
// ============================================

export interface FigmaPluginVariableCollection {
  id?: string;
  name: string;
  modes: string[];
  variables: FigmaPluginVariable[];
}

export type FigmaVariableScope =
  | "ALL_SCOPES"
  | "TEXT_CONTENT"
  | "CORNER_RADIUS"
  | "WIDTH_HEIGHT"
  | "GAP"
  | "ALL_FILLS"
  | "FRAME_FILL"
  | "SHAPE_FILL"
  | "TEXT_FILL"
  | "STROKE_COLOR"
  | "EFFECT_COLOR"
  | "STROKE_FLOAT"
  | "EFFECT_FLOAT"
  | "OPACITY"
  | "FONT_FAMILY"
  | "FONT_STYLE"
  | "FONT_WEIGHT"
  | "FONT_SIZE"
  | "LINE_HEIGHT"
  | "LETTER_SPACING"
  | "PARAGRAPH_SPACING"
  | "PARAGRAPH_INDENT";

export type FigmaVariableType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";

export interface FigmaPluginVariable {
  id?: string;
  name: string;
  type: FigmaVariableType;
  description?: string;
  valuesByMode: Record<string, string | number | boolean>;
  scopes: FigmaVariableScope[];
  codePath: string;
}

// ============================================
// COMPONENTS
// ============================================

export interface FigmaPluginComponent {
  name: string;
  description?: string;
  variantProperties: Record<string, string[]>;
  componentProperties?: FigmaPluginComponentProperty[];
  variants: FigmaPluginComponentVariant[];
  slots: FigmaPluginSlot[];
}

export type FigmaComponentPropertyType = "BOOLEAN" | "TEXT" | "INSTANCE_SWAP";

export interface FigmaPluginComponentProperty {
  name: string;
  type: FigmaComponentPropertyType;
  defaultValue: boolean | string;
  preferredValues?: string[];
}

export interface FigmaPluginComponentVariant {
  name: string;
  properties: Record<string, string>;
  tokenBindings: Record<string, string>;
}

// ============================================
// SLOTS
// ============================================

export type FigmaSlotType = "FRAME" | "TEXT" | "RECTANGLE" | "ELLIPSE" | "VECTOR";

export type FigmaLayoutMode = "HORIZONTAL" | "VERTICAL" | "NONE";

export type FigmaSizingMode = "FIXED" | "AUTO" | "FILL";

export type FigmaAxisAlign = "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN" | "BASELINE";

export interface FigmaPluginSlot {
  id: string;
  type: FigmaSlotType;
  name: string;
  isRoot?: boolean;
  parent?: string;
  children?: string[];
  layoutMode?: FigmaLayoutMode;
  primaryAxisSizing?: FigmaSizingMode;
  counterAxisSizing?: FigmaSizingMode;
  primaryAxisAlignItems?: FigmaAxisAlign;
  counterAxisAlignItems?: FigmaAxisAlign;
  variableBindings: Record<string, string>;
  defaults: Record<string, unknown>;
}

// ============================================
// TEXT STYLES
// ============================================

export type FigmaTextCase = "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";

export type FigmaTextDecoration = "NONE" | "UNDERLINE" | "STRIKETHROUGH";

export interface FigmaPluginTextStyle {
  name: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: number | "AUTO";
  letterSpacing: number;
  textCase?: FigmaTextCase;
  textDecoration?: FigmaTextDecoration;
  paragraphSpacing?: number;
  paragraphIndent?: number;
}

// ============================================
// EFFECT STYLES
// ============================================

export type FigmaEffectType =
  | "DROP_SHADOW"
  | "INNER_SHADOW"
  | "LAYER_BLUR"
  | "BACKGROUND_BLUR";

export interface FigmaPluginEffect {
  type: FigmaEffectType;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  radius: number;
  spread?: number;
  visible: boolean;
}

export interface FigmaPluginEffectStyle {
  name: string;
  effects: FigmaPluginEffect[];
}

// ============================================
// CODE CONNECT
// ============================================

export interface FigmaPluginCodeConnect {
  componentName: string;
  importPath: string;
  exportName?: string;
  props: FigmaPluginCodeConnectProp[];
}

export interface FigmaPluginCodeConnectProp {
  figmaProperty: string;
  codeProp: string;
  valueMapping?: Record<string, string | boolean | number>;
}

// ============================================
// VALIDATION
// ============================================

export function isValidFigmaPluginExport(data: unknown): data is FigmaPluginExport {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;

  return (
    obj.version === "1.0.0" &&
    typeof obj.exportedAt === "string" &&
    obj.source === "rivers-ds" &&
    Array.isArray(obj.variableCollections) &&
    Array.isArray(obj.components)
  );
}
