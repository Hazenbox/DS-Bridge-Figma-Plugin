/**
 * DS BRIDGE - FIGMA PLUGIN
 *
 * Main plugin entry point that runs in Figma's sandbox.
 * Handles communication with UI and Figma API calls.
 */

import type { FigmaPluginExport } from "./types/schema";
import { createVariableCollections } from "./generators/variables";
import { createComponentSets } from "./generators/components";
import { createTextStyles, createEffectStyles } from "./generators/styles";

// Show plugin UI
figma.showUI(__html__, {
  width: 420,
  height: 600,
  themeColors: true,
});

// Message types
type MessageType =
  | { type: "import"; data: FigmaPluginExport }
  | { type: "cancel" }
  | { type: "get-existing-variables" };

// Handle messages from UI
figma.ui.onmessage = async (msg: MessageType) => {
  try {
    switch (msg.type) {
      case "import":
        await handleImport(msg.data);
        break;

      case "cancel":
        figma.closePlugin();
        break;

      case "get-existing-variables":
        await handleGetExistingVariables();
        break;

      default:
        console.warn("Unknown message type:", msg);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    figma.ui.postMessage({
      type: "error",
      message: errorMessage,
    });
    figma.notify(`Error: ${errorMessage}`, { error: true });
  }
};

async function handleImport(data: FigmaPluginExport) {
  figma.ui.postMessage({ type: "status", status: "importing" });

  const results = {
    variables: 0,
    components: 0,
    textStyles: 0,
    effectStyles: 0,
    errors: [] as string[],
  };

  try {
    // Step 1: Create variable collections
    figma.ui.postMessage({
      type: "progress",
      current: 0,
      total: 4,
      message: "Creating variables...",
    });

    const variableMap = await createVariableCollections(data.variableCollections);
    results.variables = variableMap.size;

    // Step 2: Create text styles
    if (data.textStyles && data.textStyles.length > 0) {
      figma.ui.postMessage({
        type: "progress",
        current: 1,
        total: 4,
        message: "Creating text styles...",
      });

      await createTextStyles(data.textStyles);
      results.textStyles = data.textStyles.length;
    }

    // Step 3: Create effect styles
    if (data.effectStyles && data.effectStyles.length > 0) {
      figma.ui.postMessage({
        type: "progress",
        current: 2,
        total: 4,
        message: "Creating effect styles...",
      });

      await createEffectStyles(data.effectStyles);
      results.effectStyles = data.effectStyles.length;
    }

    // Step 4: Create components
    if (data.components && data.components.length > 0) {
      figma.ui.postMessage({
        type: "progress",
        current: 3,
        total: 4,
        message: "Creating components...",
      });

      await createComponentSets(data.components, variableMap);
      results.components = data.components.length;
    }

    figma.ui.postMessage({
      type: "progress",
      current: 4,
      total: 4,
      message: "Done!",
    });

    // Send success message
    figma.ui.postMessage({
      type: "import-complete",
      results,
    });

    figma.notify(
      `Imported: ${results.variables} variables, ${results.components} components, ${results.textStyles} text styles, ${results.effectStyles} effect styles`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Import failed";
    results.errors.push(errorMessage);

    figma.ui.postMessage({
      type: "import-error",
      message: errorMessage,
      results,
    });
  }
}

async function handleGetExistingVariables() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const existing: Record<string, string[]> = {};

  for (const collection of collections) {
    const variables = await figma.variables.getLocalVariablesAsync();
    const collectionVars = variables
      .filter((v) => v.variableCollectionId === collection.id)
      .map((v) => v.name);
    existing[collection.name] = collectionVars;
  }

  figma.ui.postMessage({
    type: "existing-variables",
    data: existing,
  });
}
