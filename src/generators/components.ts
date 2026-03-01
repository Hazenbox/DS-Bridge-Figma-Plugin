/**
 * COMPONENT GENERATOR
 *
 * Creates Figma Components with variants from exported JSON.
 */

import type {
  FigmaPluginComponent,
  FigmaPluginComponentVariant,
  FigmaPluginSlot,
  FigmaPluginComponentProperty,
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

    // Configure ComponentSet layout for organized grid
    componentSet.layoutMode = "HORIZONTAL";
    componentSet.layoutWrap = "WRAP";
    componentSet.itemSpacing = 24;
    componentSet.counterAxisSpacing = 24;
    componentSet.paddingLeft = 40;
    componentSet.paddingRight = 40;
    componentSet.paddingTop = 40;
    componentSet.paddingBottom = 40;
    componentSet.primaryAxisSizingMode = "AUTO";
    componentSet.counterAxisSizingMode = "AUTO";

    // Add component properties (boolean toggles, text overrides, instance swaps)
    if (componentDef.componentProperties && componentDef.componentProperties.length > 0) {
      await addComponentProperties(componentSet, componentDef.componentProperties, componentDef.slots, components);
    }

    return componentSet;
  }

  // Single component - just set name
  components[0].name = componentDef.name;
  return null;
}

/**
 * Add component properties to a ComponentSet
 * Creates boolean, text, and instance swap properties
 * 
 * IMPORTANT: Boolean properties control layer visibility via componentPropertyReferences.
 * The property ID returned from addComponentProperty() must be used exactly as-is.
 */
async function addComponentProperties(
  componentSet: ComponentSetNode,
  properties: FigmaPluginComponentProperty[],
  slots: FigmaPluginSlot[],
  components: ComponentNode[]
): Promise<void> {
  for (const prop of properties) {
    try {
      if (prop.type === "BOOLEAN") {
        // 1. Add boolean property and capture the exact property ID
        // addComponentProperty returns the ID with a unique suffix like "Show Left Icon#0:0"
        const propertyId = componentSet.addComponentProperty(
          prop.name, 
          "BOOLEAN", 
          prop.defaultValue as boolean
        );
        
        // 2. Find the slot that this boolean controls (by linkedBooleanProperty)
        const linkedSlot = slots.find(s => s.linkedBooleanProperty === prop.name);
        if (linkedSlot) {
          let linkedCount = 0;
          let missingCount = 0;
          
          // 3. Link the boolean property to the visibility of the corresponding layer in each variant
          for (const component of components) {
            const layer = component.findOne(n => n.name === linkedSlot.name);
            if (layer) {
              // Set initial visibility based on default value
              layer.visible = prop.defaultValue as boolean;
              
              // Link the layer's visibility to the component property
              // This makes the boolean toggle in the properties panel control this layer
              layer.componentPropertyReferences = {
                ...layer.componentPropertyReferences,
                visible: propertyId
              };
              linkedCount++;
            } else {
              missingCount++;
            }
          }
          
          // Log validation results
          if (missingCount > 0) {
            console.warn(
              `Boolean property "${prop.name}": linked ${linkedCount}/${components.length} variants. ` +
              `${missingCount} variants missing layer "${linkedSlot.name}" (may be icon-only variants).`
            );
          }
        } else {
          console.warn(`Boolean property "${prop.name}" has no linkedBooleanProperty in slots.`);
        }
      } else if (prop.type === "TEXT") {
        // Add text property and capture the exact property ID
        const propertyId = componentSet.addComponentProperty(
          prop.name, 
          "TEXT", 
          prop.defaultValue as string
        );
        
        let linkedCount = 0;
        
        // Find text layers named "Label" and link them
        for (const component of components) {
          const textLayer = component.findOne(
            n => n.type === "TEXT" && (n.name === "Label" || n.name === prop.name)
          ) as TextNode | null;
          if (textLayer) {
            textLayer.componentPropertyReferences = {
              ...textLayer.componentPropertyReferences,
              characters: propertyId
            };
            linkedCount++;
          }
        }
        
        // Log if not all variants have the text layer (expected for icon-only)
        if (linkedCount < components.length) {
          console.log(
            `Text property "${prop.name}": linked ${linkedCount}/${components.length} variants ` +
            `(icon-only variants don't have Label).`
          );
        }
      } else if (prop.type === "INSTANCE_SWAP") {
        // For instance swap, we need to find icon components to use as default
        const preferredValues = prop.preferredValues || [];
        
        // Try to find icon components in the document
        let defaultComponentId: string | undefined;
        if (preferredValues.length > 0) {
          const iconComponent = figma.currentPage.findOne(
            n => n.type === "COMPONENT" && preferredValues.includes(n.name)
          ) as ComponentNode | null;
          if (iconComponent) {
            defaultComponentId = iconComponent.id;
          }
        }
        
        // Add instance swap property (requires a default component ID)
        if (defaultComponentId) {
          componentSet.addComponentProperty(prop.name, "INSTANCE_SWAP", defaultComponentId);
        } else {
          console.warn(`Instance swap property "${prop.name}": no default component found.`);
        }
      }
    } catch (error) {
      console.warn(`Could not add component property "${prop.name}":`, error);
    }
  }
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

  // Check if this is an icon-only variant (Size starts with "Icon")
  const isIconOnly = variant.properties?.Size?.startsWith("Icon") || 
                     variant.tokenBindings?.hideLabel === "true";

  // Find root slot
  const rootSlot = componentDef.slots.find((s) => s.isRoot);

  if (rootSlot) {
    // Apply root slot properties to the component
    await applySlotToFrame(component, rootSlot, variableMap);

    // Apply per-variant token bindings (colors based on variant type)
    if (variant.tokenBindings && Object.keys(variant.tokenBindings).length > 0) {
      await applyVariantTokenBindings(component, variant.tokenBindings, variableMap);
    }

    // Create child nodes
    const childSlots = componentDef.slots.filter((s) => s.parent === rootSlot.id);
    for (const childSlot of childSlots) {
      // Skip Label slot for icon-only variants
      if (isIconOnly && childSlot.type === "TEXT" && 
          (childSlot.name === "Label" || childSlot.id === "label")) {
        continue;
      }
      
      const childNode = await createSlotNode(childSlot, variableMap, variant.tokenBindings);
      if (childNode) {
        component.appendChild(childNode);
        
        // For icon-only variants, show the left icon by default
        if (isIconOnly && childSlot.type === "ICON" && 
            (childSlot.name === "Left Icon" || childSlot.id === "iconLeft")) {
          childNode.visible = true;
        }
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
  variableMap: Map<string, Variable>,
  variantTokenBindings?: Record<string, string>
): Promise<SceneNode | null> {
  let node: SceneNode;

  switch (slot.type) {
    case "FRAME":
      node = figma.createFrame();
      await applySlotToFrame(node as FrameNode, slot, variableMap);
      break;

    case "TEXT":
      node = figma.createText();
      await applySlotToText(node as TextNode, slot, variableMap, variantTokenBindings);
      break;

    case "RECTANGLE":
      node = figma.createRectangle();
      break;

    case "ELLIPSE":
      node = figma.createEllipse();
      break;

    case "ICON":
      // Pass textFill from variant token bindings so icon color matches button text
      node = await createIconSlot(slot, variableMap, variantTokenBindings?.textFill);
      break;

    default:
      node = figma.createFrame();
      await applySlotToFrame(node as FrameNode, slot, variableMap);
  }

  node.name = slot.name;

  return node;
}

/**
 * Create an icon slot - either as an instance of an icon component or a placeholder frame
 * Icons inherit their color from the button's textFill variable to match the label color
 */
async function createIconSlot(
  slot: FigmaPluginSlot,
  variableMap: Map<string, Variable>,
  textFillVariableName?: string
): Promise<FrameNode | InstanceNode> {
  const width = (slot.defaults?.width as number) || 16;
  const height = (slot.defaults?.height as number) || 16;
  const defaultIconName = (slot.defaults?.defaultIcon as string) || "plus";

  // Try to find an icon component from the icon library
  let iconInstance: InstanceNode | null = null;
  
  if (slot.iconLibraryNodeId) {
    try {
      // Try to get the icon library node
      const iconLibraryNode = await figma.getNodeByIdAsync(slot.iconLibraryNodeId);
      
      if (iconLibraryNode) {
        // If it's a component set, find the default icon variant
        if (iconLibraryNode.type === "COMPONENT_SET") {
          const defaultVariant = iconLibraryNode.defaultVariant;
          if (defaultVariant) {
            iconInstance = defaultVariant.createInstance();
          } else {
            // Try to find a variant by name
            const iconVariant = iconLibraryNode.findChild(
              n => n.type === "COMPONENT" && n.name.toLowerCase().includes(defaultIconName)
            ) as ComponentNode | null;
            if (iconVariant) {
              iconInstance = iconVariant.createInstance();
            }
          }
        } else if (iconLibraryNode.type === "COMPONENT") {
          iconInstance = (iconLibraryNode as ComponentNode).createInstance();
        } else if (iconLibraryNode.type === "FRAME") {
          // It might be a frame containing icon components - search within
          const iconComponent = (iconLibraryNode as FrameNode).findOne(
            n => n.type === "COMPONENT" && n.name.toLowerCase().includes(defaultIconName)
          ) as ComponentNode | null;
          if (iconComponent) {
            iconInstance = iconComponent.createInstance();
          }
        }
      }
    } catch (error) {
      console.warn(`Could not find icon library node ${slot.iconLibraryNodeId}:`, error);
    }
  }

  // If we couldn't create an instance, search for icon components on the page
  if (!iconInstance) {
    const iconComponent = figma.currentPage.findOne(
      n => n.type === "COMPONENT" && n.name.toLowerCase().includes(defaultIconName)
    ) as ComponentNode | null;
    
    if (iconComponent) {
      iconInstance = iconComponent.createInstance();
    }
  }

  // If we have an icon instance, configure and return it
  if (iconInstance) {
    iconInstance.resize(width, height);
    iconInstance.name = slot.name;
    
    // Apply textFill color variable to icon so it matches button text color
    if (textFillVariableName) {
      const colorVariable = variableMap.get(textFillVariableName);
      if (colorVariable) {
        await applyColorToIconInstance(iconInstance, colorVariable);
      }
    }
    
    // Set visibility based on isOptional (default to hidden if optional)
    if (slot.isOptional) {
      iconInstance.visible = false;
    }
    
    // Store metadata for instance swap
    iconInstance.setPluginData("isIconSlot", "true");
    if (slot.iconLibraryNodeId) {
      iconInstance.setPluginData("iconLibraryNodeId", slot.iconLibraryNodeId);
    }
    if (slot.linkedBooleanProperty) {
      iconInstance.setPluginData("linkedBooleanProperty", slot.linkedBooleanProperty);
    }
    
    return iconInstance;
  }

  // Fallback: Create a placeholder frame if no icon component found
  const frame = figma.createFrame();
  frame.resize(width, height);
  frame.name = slot.name;
  
  // Apply textFill color variable to placeholder frame
  if (textFillVariableName) {
    const colorVariable = variableMap.get(textFillVariableName);
    if (colorVariable) {
      const solidPaint = figma.util.solidPaint("#000000");
      const boundPaint = figma.variables.setBoundVariableForPaint(
        solidPaint,
        "color",
        colorVariable
      );
      frame.fills = [boundPaint];
    }
  } else {
    // Style as a visible placeholder (light gray with icon indicator)
    frame.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
  }
  frame.cornerRadius = 2;
  
  // Fixed sizing for icons
  frame.layoutSizingHorizontal = "FIXED";
  frame.layoutSizingVertical = "FIXED";
  
  // Set visibility based on isOptional
  if (slot.isOptional) {
    frame.visible = false;
  }
  
  // Store metadata for later instance swap
  frame.setPluginData("isIconSlot", "true");
  frame.setPluginData("isPlaceholder", "true");
  if (slot.iconLibraryNodeId) {
    frame.setPluginData("iconLibraryNodeId", slot.iconLibraryNodeId);
  }
  if (slot.linkedBooleanProperty) {
    frame.setPluginData("linkedBooleanProperty", slot.linkedBooleanProperty);
  }
  
  return frame;
}

/**
 * Apply a color variable to an icon instance
 * This recursively finds all vector nodes and applies the color to their fills
 */
async function applyColorToIconInstance(
  instance: InstanceNode,
  colorVariable: Variable
): Promise<void> {
  // Create the bound paint once
  const solidPaint = figma.util.solidPaint("#000000");
  const boundPaint = figma.variables.setBoundVariableForPaint(
    solidPaint,
    "color",
    colorVariable
  );

  // Find all vector-like nodes within the instance and apply the color
  const applyToNode = (node: SceneNode) => {
    try {
      // Apply to nodes that have fills (vectors, rectangles, ellipses, etc.)
      if ("fills" in node && Array.isArray(node.fills) && node.fills.length > 0) {
        // Only apply if the current fill is a solid color (not images, gradients, etc.)
        const currentFills = node.fills as readonly Paint[];
        if (currentFills.some(f => f.type === "SOLID")) {
          (node as GeometryMixin).fills = [boundPaint];
        }
      }
      
      // Apply to strokes as well for outlined icons
      if ("strokes" in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
        const currentStrokes = node.strokes as readonly Paint[];
        if (currentStrokes.some(s => s.type === "SOLID")) {
          (node as GeometryMixin).strokes = [boundPaint];
        }
      }
    } catch (error) {
      // Some nodes may not support fill/stroke modifications
    }
  };

  // Recursively process all children
  const processChildren = (parent: SceneNode) => {
    if ("children" in parent) {
      for (const child of (parent as ChildrenMixin).children) {
        applyToNode(child);
        processChildren(child);
      }
    }
  };

  // Apply to the instance itself and all its children
  applyToNode(instance);
  processChildren(instance);
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
  variableMap: Map<string, Variable>,
  variantTokenBindings?: Record<string, string>
): Promise<void> {
  // Get font family from variable binding or use Geist as default (design system font)
  let fontFamily = "Geist";
  const fontFamilyVarName = slot.variableBindings.fontFamily;
  if (fontFamilyVarName) {
    const fontVar = variableMap.get(fontFamilyVarName);
    if (fontVar) {
      try {
        const collection = await figma.variables.getVariableCollectionByIdAsync(fontVar.variableCollectionId);
        if (collection) {
          const modeId = collection.defaultModeId;
          const value = fontVar.valuesByMode[modeId];
          if (typeof value === "string") {
            fontFamily = value;
          }
        }
      } catch (error) {
        console.warn("Could not resolve font family variable:", error);
      }
    }
  }
  
  // Load the correct font with fallback chain
  let fontLoaded = false;
  const fontStyles = ["Medium", "Regular"];
  
  for (const style of fontStyles) {
    if (fontLoaded) break;
    try {
      await figma.loadFontAsync({ family: fontFamily, style });
      textNode.fontName = { family: fontFamily, style };
      fontLoaded = true;
    } catch {
      // Try next style
    }
  }
  
  // Ultimate fallback to Inter if preferred font not available
  if (!fontLoaded) {
    for (const style of fontStyles) {
      try {
        await figma.loadFontAsync({ family: "Inter", style });
        textNode.fontName = { family: "Inter", style };
        fontLoaded = true;
        break;
      } catch {
        // Try next style
      }
    }
  }

  // Set text content
  const text = (slot.defaults?.text as string) || slot.name;
  textNode.characters = text;

  // Determine text fill variable - prefer variant-specific, then slot default
  let textFillVariable: string | undefined;
  if (variantTokenBindings?.textFill) {
    textFillVariable = variantTokenBindings.textFill;
  } else if (slot.variableBindings.textFill) {
    textFillVariable = slot.variableBindings.textFill;
  }

  // Apply text fill variable
  if (textFillVariable) {
    const variable = variableMap.get(textFillVariable);
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

  // Apply typography variable bindings (fontSize, fontWeight, lineHeight, letterSpacing)
  const typographyFields = ["fontSize", "fontWeight", "lineHeight", "letterSpacing"];
  
  // First apply slot default bindings
  for (const [fieldName, variableName] of Object.entries(slot.variableBindings)) {
    if (typographyFields.includes(fieldName) && typeof variableName === "string") {
      const variable = variableMap.get(variableName);
      if (variable) {
        try {
          textNode.setBoundVariable(fieldName as VariableBindableTextField, variable);
        } catch (error) {
          console.warn(`Could not bind ${fieldName} to text node:`, error);
        }
      }
    }
  }
  
  // CRITICAL: Override with variant-specific typography bindings
  // This ensures each button size gets its correct fontSize, fontWeight, etc.
  if (variantTokenBindings) {
    for (const [fieldName, variableName] of Object.entries(variantTokenBindings)) {
      if (typographyFields.includes(fieldName) && typeof variableName === "string") {
        const variable = variableMap.get(variableName);
        if (variable) {
          try {
            textNode.setBoundVariable(fieldName as VariableBindableTextField, variable);
          } catch (error) {
            console.warn(`Could not bind variant ${fieldName} to text node:`, error);
          }
        }
      }
    }
  }
}

/**
 * Apply variable bindings to a frame
 * Bindings: key = Figma field name, value = variable name (or array of variable names)
 */
async function applyVariableBindings(
  frame: FrameNode | ComponentNode,
  bindings: Record<string, string | string[]>,
  variableMap: Map<string, Variable>
): Promise<void> {
  for (const [fieldName, variableName] of Object.entries(bindings)) {
    if (typeof variableName !== "string") continue;

    const variable = variableMap.get(variableName);
    if (!variable) {
      console.warn(`Variable not found: ${variableName} (for field ${fieldName})`);
      continue;
    }

    try {
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
        frame.strokeWeight = 1;
      } else if (isBindableField(fieldName)) {
        frame.setBoundVariable(fieldName as VariableBindableNodeField, variable);
      }
    } catch (error) {
      console.warn(`Could not bind variable ${variableName} to ${fieldName}:`, error);
    }
  }
}

/**
 * Apply per-variant token bindings (colors, sizes, spacing overrides)
 * key = Figma field name, value = variable name
 */
async function applyVariantTokenBindings(
  frame: FrameNode | ComponentNode,
  tokenBindings: Record<string, string>,
  variableMap: Map<string, Variable>
): Promise<void> {
  for (const [fieldName, variableName] of Object.entries(tokenBindings)) {
    if (fieldName === "_state") continue;

    const variable = variableMap.get(variableName);

    try {
      if (fieldName === "fill" && variable) {
        const solidPaint = figma.util.solidPaint("#000000");
        const boundPaint = figma.variables.setBoundVariableForPaint(
          solidPaint,
          "color",
          variable
        );
        frame.fills = [boundPaint];
      } else if (fieldName === "fill" && !variable) {
        frame.fills = [];
      } else if (fieldName === "textFill") {
        // textFill is applied to child text nodes, not the frame itself - skip here
        continue;
      } else if (fieldName === "stroke" && variable) {
        const solidPaint = figma.util.solidPaint("#000000");
        const boundPaint = figma.variables.setBoundVariableForPaint(
          solidPaint,
          "color",
          variable
        );
        frame.strokes = [boundPaint];
        frame.strokeWeight = 1;
      } else if (variable && isBindableField(fieldName)) {
        frame.setBoundVariable(fieldName as VariableBindableNodeField, variable);
      }
    } catch (error) {
      console.warn(`Could not apply variant binding ${fieldName}:`, error);
    }
  }
}

/**
 * Check if a field can be bound to a variable on a frame
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

// Type for text node bindable fields
type VariableBindableTextField = "fontSize" | "fontWeight" | "lineHeight" | "letterSpacing" | "paragraphSpacing" | "paragraphIndent";

/**
 * Apply default values to a frame
 */
function applyDefaults(frame: FrameNode | ComponentNode, defaults: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(defaults)) {
    if (typeof value !== "number") continue;
    try {
      switch (key) {
        case "width":
          frame.resize(value, frame.height);
          break;
        case "height":
          frame.resize(frame.width, value);
          break;
        case "paddingLeft":
          frame.paddingLeft = value;
          break;
        case "paddingRight":
          frame.paddingRight = value;
          break;
        case "paddingTop":
          frame.paddingTop = value;
          break;
        case "paddingBottom":
          frame.paddingBottom = value;
          break;
        case "itemSpacing":
          frame.itemSpacing = value;
          break;
        case "cornerRadius":
          frame.cornerRadius = value;
          break;
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
