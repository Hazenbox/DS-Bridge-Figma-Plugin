/**
 * VARIABLE GENERATOR
 *
 * Creates Figma Variable Collections from exported JSON.
 */

import type { FigmaPluginVariableCollection, FigmaPluginVariable } from "../types/schema";
import { parseColor } from "../utils/colors";

/**
 * Create all variable collections and return a map of codePath -> Variable
 */
export async function createVariableCollections(
  collections: FigmaPluginVariableCollection[]
): Promise<Map<string, Variable>> {
  const variableMap = new Map<string, Variable>();

  for (const collDef of collections) {
    try {
      // Create collection
      const collection = figma.variables.createVariableCollection(collDef.name);

      // Set up modes (rename default, add others)
      const modeIds: string[] = [];

      for (let i = 0; i < collDef.modes.length; i++) {
        if (i === 0) {
          // Rename the default mode
          collection.renameMode(collection.defaultModeId, collDef.modes[i]);
          modeIds.push(collection.defaultModeId);
        } else {
          // Add new mode
          try {
            const newModeId = collection.addMode(collDef.modes[i]);
            modeIds.push(newModeId);
          } catch (error) {
            // Mode limit reached (free tier = 1, pro = 4)
            console.warn(`Could not add mode "${collDef.modes[i]}": mode limit reached`);
            figma.notify(`Mode limit reached. Upgrade Figma plan for more modes.`, {
              error: true,
            });
            break;
          }
        }
      }

      // Create variables
      for (const varDef of collDef.variables) {
        try {
          const variable = await createVariable(collection, varDef, modeIds, collDef.modes);
          // Store by variable name (primary key for bindings)
          variableMap.set(varDef.name, variable);
          // Also store by codePath as fallback for legacy references
          if (varDef.codePath && varDef.codePath !== varDef.name) {
            variableMap.set(varDef.codePath, variable);
          }
        } catch (error) {
          console.error(`Failed to create variable "${varDef.name}":`, error);
        }
      }

      // Yield to prevent UI freezing
      await delay(10);
    } catch (error) {
      console.error(`Failed to create collection "${collDef.name}":`, error);
    }
  }

  return variableMap;
}

async function createVariable(
  collection: VariableCollection,
  varDef: FigmaPluginVariable,
  modeIds: string[],
  modeNames: string[]
): Promise<Variable> {
  // Map type string to Figma VariableResolvedDataType
  const typeMap: Record<string, VariableResolvedDataType> = {
    COLOR: "COLOR",
    FLOAT: "FLOAT",
    STRING: "STRING",
    BOOLEAN: "BOOLEAN",
  };

  const figmaType = typeMap[varDef.type] || "FLOAT";

  // Create the variable
  const variable = figma.variables.createVariable(varDef.name, collection, figmaType);

  // Set description
  if (varDef.description) {
    variable.description = varDef.description;
  }

  // Set values for each mode
  for (let i = 0; i < modeIds.length; i++) {
    const modeId = modeIds[i];
    const modeName = modeNames[i];
    const rawValue = varDef.valuesByMode[modeName];

    if (rawValue !== undefined) {
      const convertedValue = convertValue(rawValue, varDef.type);
      variable.setValueForMode(modeId, convertedValue);
    }
  }

  // Set scopes
  if (varDef.scopes && varDef.scopes.length > 0) {
    variable.scopes = varDef.scopes as VariableScope[];
  }

  return variable;
}

/**
 * Convert a value to the appropriate Figma format
 */
function convertValue(
  value: string | number | boolean,
  type: string
): VariableValue {
  if (type === "COLOR" && typeof value === "string") {
    const rgba = parseColor(value);
    return { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a };
  }

  if (type === "FLOAT" && typeof value === "string") {
    // Parse pixel values like "32px"
    if (value.endsWith("px")) {
      return parseFloat(value);
    }
    return parseFloat(value) || 0;
  }

  if (type === "BOOLEAN") {
    return Boolean(value);
  }

  return value;
}

/**
 * Small delay to yield to Figma UI
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
