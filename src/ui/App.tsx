import React, { useState, useCallback, useEffect } from "react";
import type { FigmaPluginExport } from "../types/schema";
import { isValidFigmaPluginExport } from "../types/schema";

type Status = "idle" | "importing" | "done" | "error";

interface Progress {
  current: number;
  total: number;
  message: string;
}

interface Results {
  variables: number;
  components: number;
  textStyles: number;
  effectStyles: number;
  errors: string[];
}

export default function App() {
  const [exportData, setExportData] = useState<FigmaPluginExport | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 0, message: "" });
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Listen for messages from plugin code
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case "status":
          setStatus(msg.status);
          break;
        case "progress":
          setProgress(msg);
          break;
        case "import-complete":
          setStatus("done");
          setResults(msg.results);
          break;
        case "import-error":
          setStatus("error");
          setError(msg.message);
          if (msg.results) setResults(msg.results);
          break;
        case "error":
          setStatus("error");
          setError(msg.message);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!isValidFigmaPluginExport(data)) {
        setError("Invalid export file format. Please export from Rivers DS.");
        return;
      }

      setExportData(data);
      setFileName(file.name);
      setError("");
      setResults(null);
      setStatus("idle");
    } catch (err) {
      setError("Failed to parse JSON file. Please check the file format.");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/json") {
        handleFileUpload(file);
      } else {
        setError("Please drop a JSON file.");
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleImport = useCallback(() => {
    if (!exportData) return;

    setStatus("importing");
    setProgress({ current: 0, total: 4, message: "Starting import..." });
    setError("");

    parent.postMessage(
      {
        pluginMessage: { type: "import", data: exportData },
      },
      "*"
    );
  }, [exportData]);

  const handleCancel = useCallback(() => {
    parent.postMessage({ pluginMessage: { type: "cancel" } }, "*");
  }, []);

  const handleClear = useCallback(() => {
    setExportData(null);
    setFileName("");
    setResults(null);
    setError("");
    setStatus("idle");
  }, []);

  const countVariables = (data: FigmaPluginExport): number => {
    return data.variableCollections.reduce((sum, c) => sum + c.variables.length, 0);
  };

  return (
    <div className="container">
      <div className="header">
        <h1>DS Bridge</h1>
        <span className="version">v1.0.0</span>
      </div>

      {/* File Upload */}
      {!exportData && (
        <div
          className={`file-upload ${isDragOver ? "dragover" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept=".json"
            onChange={handleInputChange}
            id="file-input"
          />
          <label htmlFor="file-input" style={{ cursor: "pointer" }}>
            <div className="icon">+</div>
            <p>
              <strong>Drop JSON file</strong> or click to upload
            </p>
            <p style={{ fontSize: "11px", marginTop: "4px" }}>
              Export from Rivers DS Component Editor
            </p>
          </label>
        </div>
      )}

      {/* File Info */}
      {exportData && (
        <div className="file-info">
          <span className="name">{fileName}</span>
          <span className="remove" onClick={handleClear} title="Remove file">
            x
          </span>
        </div>
      )}

      {/* Preview */}
      {exportData && status === "idle" && (
        <div className="preview">
          <h2>Preview</h2>
          <div className="preview-grid">
            <div className="preview-item">
              <span className="label">Variables</span>
              <span className="value">{countVariables(exportData)}</span>
            </div>
            <div className="preview-item">
              <span className="label">Components</span>
              <span className="value">{exportData.components.length}</span>
            </div>
            <div className="preview-item">
              <span className="label">Text Styles</span>
              <span className="value">{exportData.textStyles?.length || 0}</span>
            </div>
            <div className="preview-item">
              <span className="label">Effect Styles</span>
              <span className="value">{exportData.effectStyles?.length || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      {status === "importing" && (
        <div className="progress-section">
          <div className="progress-message">{progress.message}</div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {status === "done" && results && (
        <div className="results">
          <h3>Import Complete</h3>
          <ul>
            <li>{results.variables} variables created</li>
            <li>{results.components} components created</li>
            <li>{results.textStyles} text styles created</li>
            <li>{results.effectStyles} effect styles created</li>
          </ul>
        </div>
      )}

      {/* Error */}
      {error && <div className="error">{error}</div>}

      {/* Buttons */}
      <div className="button-row">
        <button
          className="button button-primary"
          onClick={handleImport}
          disabled={!exportData || status === "importing"}
        >
          {status === "importing" ? "Importing..." : "Import to Figma"}
        </button>
        <button className="button button-secondary" onClick={handleCancel}>
          Close
        </button>
      </div>
    </div>
  );
}
