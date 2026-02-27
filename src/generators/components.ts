/**
 * COMPONENT GENERATOR
 *
 * Creates Figma Components with variants from exported JSON.
 */

import type {
  FigmaPluginComponent,
  FigmaPluginComponentVariant,
  FigmaPluginSlot,
} from "../types/schema";
import { parseColor } from "../utils/colors";

/**
 * Create all component sets
 */
export async function createComponentSets(
  components: FigmaPluginComponent[],
  variableMap: Map<string, Variable>
): Promise<void> {
  for (const componentDef of components) {
    try {
      await createComponentSet(componentDef, variableMap);
      // Yield to prevent UI freezing
      await delay(10);
    } catch (error) {
      console.error(`Failed to create component "${componentDef.name}":`, error);
    }
  }
}

/**
 * Create a single ComponentSet with all variants
 */
async function createComponentSet(
  componentDef: FigmaPluginComponent,
  variableMap: Map<string, Variable>
): Promise<ComponentSetNode | null> {
  const components: ComponentNode[] = [];

  // If no variants defined, create a single component
  if (!componentDef.variants || componentDef.variants.length === 0) {
    const component = await createSingleComponent(
      componentDef,
      { name: componentDef.name, properties: {}, tokenBindings: {} },
      variableMap
    );
    if (component) {
      components.push(component);
    }
  } else {
    // Create each variant
    for (const variant of componentDef.variants) {
      const component = await createSingleComponent(componentDef, variant, variableMap);
      if (component) {
        components.push(component);
      }
      // Yield between variants
      await delay(5);
    }
  }

  if (components.length === 0) {
    return null;
  }

  // Combine into ComponentSet if multiple variants
  if (components.length > 1) {
    const componentSet = figma.combineAsVariants(components, figma.currentPage);
    componentSet.name = componentDef.name;

    if (componentDef.description) {
      componentSet.description = componentDef.description;
    }

    return componentSet;
  }

  // Single component - just set name
  components[0].name = componentDef.name;
  return null;
}

/**
 * Create a single component instance
 */
async function createSingleComponent(
  componentDef: FigmaPluginComponent,
  variant: FigmaPluginComponentVariant,
  variableMap: Map<string, Variable>
): Promise<ComponentNode> {
  // Create the component
  const component = figma.createComponent();
  component.name = variant.name || componentDef.name;

  // Find root slot
  const rootSlot = componentDef.slots.find((s) => s.isRoot);

  if (rootSlot) {
    // Apply root slot properties to the component
    await applySlotToFrame(component, rootSlot, variableMap);

    // Create child nodes
    const childSlots = componentDef.slots.filter((s) => s.parent === rootSlot.id);
    for (const childSlot of childSlots) {
      const childNode = await createSlotNode(childSlot, variableMap);
      if (childNode) {
        component.appendChild(childNode);
      }
    }
  } else {
    // No root slot - set basic properties
    component.layoutMode = "HORIZONTAL";
    component.primaryAxisSizingMode = "AUTO";
    component.counterAxisSizingMode = "AUTO";
    component.paddingLeft = 16;
    component.paddingRight = 16;
    component.paddingTop = 8;
    component.paddingBottom = 8;
    component.itemSpacing = 8;
  }

  return component;
}

/**
 * Create a node from a slot definition
 */
async function createSlotNode(
  slot: FigmaPluginSlot,
  variableMap: Map<string, Variable>
): Promise<SceneNode | null> {
  let node: SceneNode;

  switch (slot.type) {
    case "FRAME":
      node = figma.createFrame();
      await applySlotToFrame(node as FrameNode, slot, variableMap);
      break;

    case "TEXT":
      node = figma.createText();
      await applySlotToText(node as TextNode, slot, variableMap);
      break;

    case "RECTANGLE":
      node = figma.createRectangle();
      break;

    case "ELLIPSE":
      node = figma.createEllipse();
      break;

    default:
      node = figma.createFrame();
      await applySlotToFrame(node as FrameNode, slot, variableMap);
  }

  node.name = slot.name;

  return node;
}

/**
 * Apply slot properties to a frame
 */
async function applySlotToFrame(
  frame: FrameNode | ComponentNode,
  slot: FigmaPluginSlot,
  variableMap: Map<string, Variable>
): Promise<void> {
  // Layout mode
  if (slot.layoutMode && slot.layoutMode !== "NONE") {
    frame.layoutMode = slot.layoutMode;
  }

  // Sizing
  frame.primaryAxisSizingMode = mapSizingMode(slot.primaryAxisSizing);
  frame.counterAxisSizingMode = mapSizingMode(slot.counterAxisSizing);

  // Alignment
  if (slot.primaryAxisAlignItems) {
    frame.primaryAxisAlignItems = slot.primaryAxisAlignItems as
      | "MIN"
      | "MAX"
      | "CENTER"
      | "SPACE_BETWEEN";
  }
  if (slot.counterAxisAlignItems && slot.counterAxisAlignItems !== "BASELINE") {
    frame.counterAxisAlignItems = slot.counterAxisAlignItems as "MIN" | "MAX" | "CENTER";
  }

  // Apply variable bindings
  await applyVariableBindings(frame, slot.variableBindings, variableMap);

  // Apply defaults for any non-bound properties
  if (slot.defaults) {
    applyDefaults(frame, slot.defaults);
  }
}

/**
 * Apply slot properties to a text node
 */
async function applySlotToText(
  textNode: TextNode,
  slot: FigmaPluginSlot,
  variableMap: Map<string, Variable>
): Promise<void> {
  // Load default font
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  // Set text content
  const text = (slot.defaults?.text as string) || slot.name;
  textNode.characters = text;

  // Apply text fill variable
  if (slot.variableBindings.textFill) {
    const variable = variableMap.get(slot.variableBindings.textFill);
    if (variable) {
      const solidPaint = figma.util.solidPaint("#000000");
      const boundPaint = figma.variables.setBoundVariableForPaint(
        solidPaint,
        "color",
        variable
      );
      textNode.fills = [boundPaint];
    }
  }
}

/**
 * Apply variable bindings to a frame
 */
async function applyVariableBindings(
  frame: FrameNode | ComponentNode,
  bindings: Record<string, string>,
  variableMap: Map<string, Variable>
): Promise<void> {
  for (const [codePath, fieldName] of Object.entries(bindings)) {
    const variable = variableMap.get(codePath);
    if (!variable) continue;

    try {
      // Handle color bindings separately
      if (fieldName === "fill") {
        const solidPaint = figma.util.solidPaint("#000000");
        const boundPaint = figma.variables.setBoundVariableForPaint(
          solidPaint,
          "color",
          variable
        );
        frame.fills = [boundPaint];
      } else if (fieldName === "stroke") {
        const solidPaint = figma.util.solidPaint("#000000");
        const boundPaint = figma.variables.setBoundVariableForPaint(
          solidPaint,
          "color",
          variable
        );
        frame.strokes = [boundPaint];
      } else if (isBindableField(fieldName)) {
        // Numeric bindings
        frame.setBoundVariable(fieldName as VariableBindableNodeField, variable);
      }
    } catch (error) {
      console.warn(`Could not bind variable to ${fieldName}:`, error);
    }
  }
}

/**
 * Check if a field can be bound to a variable
 */
function isBindableField(field: string): boolean {
  const bindableFields = [
    "height",
    "width",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "itemSpacing",
    "counterAxisSpacing",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "paddingBottom",
    "topLeftRadius",
    "topRightRadius",
    "bottomLeftRadius",
    "bottomRightRadius",
    "strokeWeight",
    "opacity",
  ];
  return bindableFields.includes(field);
}

/**
 * Apply default values to a frame
 */
function applyDefaults(frame: FrameNode | ComponentNode, defaults: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(defaults)) {
    try {
      if (key === "paddingLeft" && typeof value === "number") {
        frame.paddingLeft = value;
      } else if (key === "paddingRight" && typeof value === "number") {
        frame.paddingRight = value;
      } else if (key === "paddingTop" && typeof value === "number") {
        frame.paddingTop = value;
      } else if (key === "paddingBottom" && typeof value === "number") {
        frame.paddingBottom = value;
      } else if (key === "itemSpacing" && typeof value === "number") {
        frame.itemSpacing = value;
      } else if (key === "cornerRadius" && typeof value === "number") {
        frame.cornerRadius = value;
      }
    } catch (error) {
      console.warn(`Could not apply default ${key}:`, error);
    }
  }
}

/**
 * Map sizing mode string to Figma type
 */
function mapSizingMode(mode?: string): "FIXED" | "AUTO" {
  if (mode === "FILL" || mode === "AUTO") return "AUTO";
  if (mode === "FIXED") return "FIXED";
  return "AUTO";
}

/**
 * Small delay to yield to Figma UI
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
