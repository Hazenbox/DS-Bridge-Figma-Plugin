/**
 * VARIABLE GENERATOR
 *
 * Creates Figma Variable Collections from exported JSON.
 */

import type { FigmaPluginVariableCollection, FigmaPluginVariable } from "../types/schema";
import { parseColor } from "../utils/colors";

/**
 * Create all variable collections and return a map of name -> Variable.
 * Deduplicates: if a collection with the same name already exists, reuses it
 * and updates existing variables instead of creating duplicates.
 */
export async function createVariableCollections(
  collections: FigmaPluginVariableCollection[]
): Promise<Map<string, Variable>> {
  const variableMap = new Map<string, Variable>();

  const existingCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const existingCollectionsByName = new Map<string, VariableCollection>();
  for (const c of existingCollections) {
    existingCollectionsByName.set(c.name, c);
  }

  const existingVariables = await figma.variables.getLocalVariablesAsync();
  const existingVarsByCollectionAndName = new Map<string, Variable>();
  for (const v of existingVariables) {
    existingVarsByCollectionAndName.set(`${v.variableCollectionId}/${v.name}`, v);
  }

  for (const collDef of collections) {
    try {
      let collection = existingCollectionsByName.get(collDef.name);
      let modeIds: string[];

      if (collection) {
        modeIds = collection.modes.map((m) => m.modeId);
      } else {
        collection = figma.variables.createVariableCollection(collDef.name);
        modeIds = [];

        for (let i = 0; i < collDef.modes.length; i++) {
          if (i === 0) {
            collection.renameMode(collection.defaultModeId, collDef.modes[i]);
            modeIds.push(collection.defaultModeId);
          } else {
            try {
              const newModeId = collection.addMode(collDef.modes[i]);
              modeIds.push(newModeId);
            } catch (error) {
              console.warn(`Could not add mode "${collDef.modes[i]}": mode limit reached`);
              figma.notify(`Mode limit reached. Upgrade Figma plan for more modes.`, {
                error: true,
              });
              break;
            }
          }
        }
      }

      for (const varDef of collDef.variables) {
        try {
          const existingVar = existingVarsByCollectionAndName.get(
            `${collection.id}/${varDef.name}`
          );

          let variable: Variable;
          if (existingVar) {
            variable = existingVar;
            if (varDef.description) variable.description = varDef.description;
            if (varDef.scopes?.length) variable.scopes = varDef.scopes as VariableScope[];
          } else {
            variable = await createVariable(collection, varDef, modeIds, collDef.modes);
          }

          // Update mode values even for existing variables
          for (let i = 0; i < modeIds.length; i++) {
            const modeName = collDef.modes[i];
            const rawValue = varDef.valuesByMode[modeName];
            if (rawValue !== undefined) {
              const convertedValue = convertValue(rawValue, varDef.type);
              variable.setValueForMode(modeIds[i], convertedValue);
            }
          }

          variableMap.set(varDef.name, variable);
          if (varDef.codePath && varDef.codePath !== varDef.name) {
            variableMap.set(varDef.codePath, variable);
          }
        } catch (error) {
          console.error(`Failed to create variable "${varDef.name}":`, error);
        }
      }

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
