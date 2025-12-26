// const fs = require("fs");
// const path = require("path");
// const AdmZip = require("adm-zip");

// let currentZip = null;
// let currentWorkspacePath = null;

// // --- CONSTANTS ---
// const TVWS_METADATA = "metadata.json";
// const TVWS_HTTP_SCENARIO_CONFIG = "http/scenario/config.json";
// const TVWS_HTTP_SCENARIO_TESTCASE = "http/scenario/testcase.json";
// const TVWS_HTTP_SCENARIO_RESULT = "http/scenario/result.json";
// const TVWS_HTTP_STRESS_INDEX = "http/stress/index.json";
// const TVWS_HTTP_ENDURANCE_INDEX = "http/endurance/index.json";
// const TVWS_WS_INDEX = "ws/index.json";
// const TVWS_SSE_INDEX = "sse/index.json";
// const TVWS_GRPC_INDEX = "grpc/index.json";
// // --- FUNCTIONS ---
// function createWorkspaceFile(folderPath, name) {
//   const filePath = path.join(folderPath, `${name}.tvws`);
//   try {
//     currentZip = new AdmZip();
//     const metadata = {
//       name,
//       version: "2.0",
//       created: new Date().toISOString(),
//       lastModified: new Date().toISOString(),
//       activeEnv: "development",
//     };
//     currentZip.addFile(TVWS_METADATA, Buffer.from(JSON.stringify(metadata, null, 2)));
//     currentZip.addFile(TVWS_HTTP_SCENARIO_CONFIG, Buffer.from(JSON.stringify({}, null, 2)));
//     currentZip.addFile(TVWS_HTTP_SCENARIO_TESTCASE, Buffer.from(JSON.stringify({}, null, 2)));
//     currentZip.addFile(TVWS_HTTP_SCENARIO_RESULT, Buffer.from(JSON.stringify([], null, 2)));
//     currentZip.addFile(TVWS_HTTP_STRESS_INDEX, Buffer.from(JSON.stringify({}, null, 2)));
//     currentZip.addFile(TVWS_HTTP_ENDURANCE_INDEX, Buffer.from(JSON.stringify({}, null, 2)));
//     currentZip.addFile(TVWS_WS_INDEX, Buffer.from(JSON.stringify({}, null, 2)));
//     currentZip.addFile(TVWS_SSE_INDEX, Buffer.from(JSON.stringify({}, null, 2)));
//     currentZip.addFile(TVWS_GRPC_INDEX, Buffer.from(JSON.stringify({}, null, 2)));

//     currentZip.writeZip(filePath);
//     currentWorkspacePath = filePath;
//     return { success: true, path: filePath };
//   } catch (err) {
//     return { success: false, error: err.message };
//   }
// }
// function openWorkspaceFile(filePath) {
//   try {
//     if (!fs.existsSync(filePath)) throw new Error("File not found");
//     currentZip = new AdmZip(filePath);
//     const hasMigrated = migrateOldStructure(currentZip);
//     if (hasMigrated) {
//       currentZip.writeZip(filePath);
//       console.log("Workspace migrated to v2.0 structure");
//     }
//     const required = [TVWS_METADATA, TVWS_HTTP_SCENARIO_CONFIG, TVWS_HTTP_SCENARIO_TESTCASE];
//     const entries = currentZip.getEntries().map(e => e.entryName);
//     const missing = required.filter(req => !entries.includes(req));
//     if (missing.length > 0) {
//       throw new Error(`Invalid workspace: missing [${missing.join(", ")}]`);
//     }
//     currentWorkspacePath = filePath;
//     return { success: true, path: filePath };
//   } catch (err) {
//     return { success: false, error: err.message };
//   }
// }
// function readZipFile(zip, fileName) {
//   const entry = zip.getEntry(fileName);
//   if (!entry) throw new Error(`File ${fileName} not found in ZIP`);
//   return JSON.parse(entry.getData().toString("utf8"));
// }
// function writeZipFile(zip, fileName, data) {
//   // Xóa entry cũ nếu có
//   const existingIndex = zip.getEntries().findIndex((e) => e.entryName === fileName);
//   if (existingIndex !== -1) {
//     zip.deleteFile(zip.getEntries()[existingIndex]);
//   }
//   zip.addFile(fileName, Buffer.from(JSON.stringify(data, null, 2)));
// }
// function saveWorkspace() {
//   if (!currentZip || !currentWorkspacePath) {
//     console.error("No workspace open or path missing");
//     return false;
//   }
//   try {
//     const metadata = readZipFile(currentZip, TVWS_METADATA);
//     metadata.lastModified = new Date().toISOString();
//     writeZipFile(currentZip, TVWS_METADATA, metadata);
//     currentZip.writeZip(currentWorkspacePath);
//     return true;
//   } catch (err) {
//     console.error("Save error:", err);
//     return false;
//   }
// }
// function insertHttpResult(subType, test_id, test_result) {
//   const resultPath = `http/${subType}/result.json`;
//   let results = readZipFile(currentZip, resultPath);
//   results.push({ test_id, result: test_result, timestamp: new Date().toISOString() });
//   writeZipFile(currentZip, resultPath, results);
//   return saveWorkspace();
// }
// function getAllHttpResults(suite = null) {
//   if (!currentZip) throw new Error("No workspace open");
//   const suites = readZipFile(currentZip,TVWS_HTTP_SCENARIO_TESTCASE);
//   let resultsRaw = readZipFile(currentZip,TVWS_HTTP_SCENARIO_RESULT);
//   const resultMap = {};
//   resultsRaw.forEach((r) => {
//     resultMap[r.test_id] = r.result;
//   });
//   const allResults = [];
//   const targetSuites = suite ? { [suite]: suites[suite] || [] } : suites;
//   Object.values(targetSuites).forEach((groups) => {
//     groups.forEach((group) => {
//       group.cases.forEach((caseObj) => {
//         const res = resultMap[caseObj.id];
//         if (res) {
//           allResults.push({ ...caseObj, result: res });
//         }
//       });
//     });
//   });

//   return allResults;
// }
// function getTestCases(suite = null, group = null) {
//   if (!currentZip) throw new Error("No workspace open");

//   const suites = readZipFile(currentZip,TVWS_HTTP_SCENARIO_TESTCASE);
//   let targetSuites = suite ? { [suite]: suites[suite] || [] } : suites;
//   const allCases = [];

//   Object.values(targetSuites).forEach((groups) => {
//     groups.forEach((groupObj) => {
//       if (!group || groupObj.group === group) {
//         allCases.push(...groupObj.cases);
//       }
//     });
//   });

//   return allCases;
// }
// function getTestConfig(key = null) {
//   if (!currentZip) throw new Error("No workspace open");
//   const config = readZipFile(currentZip, TVWS_HTTP_SCENARIO_CONFIG);
//   const metadata = readZipFile(currentZip, TVWS_METADATA);
//   if (key === "global") {
//     return {
//       max_retries: config.max_retries,
//       connect_timeout: config.connect_timeout,
//       read_timeout: config.read_timeout,
//     };
//   } else if (key && key.startsWith("env_")) {
//     const envName = key.replace("env_", "");
//     const env = config.envs.find((e) => e.name === envName);
//     return env || null;
//   }
//   return {
//     ...config,
//     activeEnv: metadata.activeEnv,
//   };
// }
// function closeWorkspace() {
//   currentZip = null;
//   currentWorkspacePath = null;
//   console.log("Closed workspace");
// }
// function getZipEntries() {
//   if (!currentZip) throw new Error("No workspace open");
//   return currentZip.getEntries().map((entry) => entry.entryName);
// }
// function readZipFileContent(fileName) {
//   if (!currentZip) throw new Error("No workspace open");
//   try {
//     return readZipFile(currentZip, fileName);
//   } catch (err) {
//     throw new Error(`File not found: ${fileName}`);
//   }
// }
// function writeZipFileContent(fileName, content) {
//   if (!currentZip) throw new Error("No workspace open");
//   writeZipFile(currentZip, fileName, JSON.parse(content));
//   saveWorkspace();
// }
// function getWorkspaceInfo() {
//   if (!currentZip) return { success: false };
//   return { success: true, path: currentWorkspacePath };
// }
// function migrateOldStructure(zip) {
//   let changed = false;
//   const oldFiles = [
//     { old: "http/config.json", new: TVWS_HTTP_SCENARIO_CONFIG },
//     { old: "http/testcase.json", new: TVWS_HTTP_SCENARIO_TESTCASE },
//     { old: "http/result.json", new: TVWS_HTTP_SCENARIO_RESULT }
//   ];

//   oldFiles.forEach(file => {
//     const entry = zip.getEntry(file.old);
//     if (entry) {
//       const data = entry.getData();
//       zip.addFile(file.new, data);
//       zip.deleteFile(entry);
//       changed = true;
//     }
//   });

//   if (changed) {
//     try {
//       const metaEntry = zip.getEntry(TVWS_METADATA);
//       if (metaEntry) {
//         const metadata = JSON.parse(metaEntry.getData().toString("utf8"));
//         metadata.version = "2.0";
//         zip.addFile(TVWS_METADATA, Buffer.from(JSON.stringify(metadata, null, 2)));
//       }
//     } catch (e) {
//       console.error("Migration meta error:", e);
//     }
//   }
//   return changed;
// }
// module.exports = {
//   // CONSTANTS
//   TVWS_METADATA,
//   TVWS_HTTP_SCENARIO_CONFIG,
//   TVWS_HTTP_SCENARIO_TESTCASE,
//   TVWS_HTTP_SCENARIO_RESULT,
//   TVWS_HTTP_STRESS_INDEX,
//   TVWS_HTTP_ENDURANCE_INDEX,
//   TVWS_WS_INDEX,
//   TVWS_SSE_INDEX,
//   TVWS_GRPC_INDEX,
//   // FUNCTIONS
//   createWorkspaceFile,
//   openWorkspaceFile,
//   closeWorkspace,
//   insertHttpResult,
//   getAllHttpResults,
//   getTestCases,
//   getTestConfig,
//   saveWorkspace,
//   getZipEntries,
//   readZipFileContent,
//   writeZipFileContent,
//   getWorkspaceInfo,
// };







const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const chokidar = require("chokidar"); // npm install chokidar

let currentZip = null;
let currentWorkspacePath = null;
let fileWatcher = null;

// --- CONSTANTS (giữ nguyên tuyệt đối) ---
const TVWS_METADATA = "metadata.json";
const TVWS_HTTP_SCENARIO_CONFIG = "http/scenario/config.json";
const TVWS_HTTP_SCENARIO_TESTCASE = "http/scenario/testcase.json";
const TVWS_HTTP_SCENARIO_RESULT = "http/scenario/result.json";
const TVWS_HTTP_STRESS_INDEX = "http/stress/index.json";
const TVWS_HTTP_ENDURANCE_INDEX = "http/endurance/index.json";
const TVWS_WS_INDEX = "ws/index.json";
const TVWS_SSE_INDEX = "sse/index.json";
const TVWS_GRPC_INDEX = "grpc/index.json";

// --- CORE UTILS ---
function readZipFile(zip, fileName) {
  const entry = zip.getEntry(fileName);
  if (!entry) throw new Error(`File ${fileName} not found in ZIP`);
  return JSON.parse(entry.getData().toString("utf8"));
}

function writeZipFile(zip, fileName, data) {
  // Xóa entry cũ nếu tồn tại
  const entries = zip.getEntries();
  const existingIndex = entries.findIndex((e) => e.entryName === fileName);
  if (existingIndex !== -1) {
    zip.deleteFile(entries[existingIndex]);
  }
  zip.addFile(fileName, Buffer.from(JSON.stringify(data, null, 2)));
}

function setupWatcher(filePath, onChangeCallback) {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }

  fileWatcher = chokidar.watch(filePath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  fileWatcher
    .on("change", () => {
      console.log("[Watcher] Detected external change → reloading ZIP");
      try {
        currentZip = new AdmZip(filePath);
        if (typeof onChangeCallback === "function") {
          onChangeCallback({ type: "CHANGED", path: filePath });
        }
      } catch (err) {
        console.error("[Watcher] Reload failed:", err);
      }
    })
    .on("unlink", () => {
      console.log("[Watcher] File deleted externally!");
      if (typeof onChangeCallback === "function") {
        onChangeCallback({ type: "DELETED", path: filePath });
      }
      closeWorkspace();
    })
    .on("error", (error) => {
      console.error("[Watcher] Error:", error);
    });
}

// --- MAIN FUNCTIONS ---
function createWorkspaceFile(folderPath, name) {
  const filePath = path.join(folderPath, `${name}.tvws`);

  try {
    currentZip = new AdmZip();

    const metadata = {
      name,
      version: "2.0",
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      activeEnv: "development",
    };

    // Tạo tất cả các file mặc định
    const defaultFiles = [
      [TVWS_METADATA, metadata],
      [TVWS_HTTP_SCENARIO_CONFIG, {}],
      [TVWS_HTTP_SCENARIO_TESTCASE, {}],
      [TVWS_HTTP_SCENARIO_RESULT, []],
      [TVWS_HTTP_STRESS_INDEX, {}],
      [TVWS_HTTP_ENDURANCE_INDEX, {}],
      [TVWS_WS_INDEX, {}],
      [TVWS_SSE_INDEX, {}],
      [TVWS_GRPC_INDEX, {}],
    ];

    defaultFiles.forEach(([fileName, content]) => {
      currentZip.addFile(fileName, Buffer.from(JSON.stringify(content, null, 2)));
    });

    currentZip.writeZip(filePath);
    currentWorkspacePath = filePath;

    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function openWorkspaceFile(filePath, onExternalChange = null) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("Workspace file not found");
    }

    currentZip = new AdmZip(filePath);
    currentWorkspacePath = filePath;

    const hasMigrated = migrateOldStructure(currentZip);
    if (hasMigrated) {
      currentZip.writeZip(filePath);
      console.log("Workspace has been migrated to v2.0 structure");
    }

    // Kiểm tra các file bắt buộc
    const required = [
      TVWS_METADATA,
      TVWS_HTTP_SCENARIO_CONFIG,
      TVWS_HTTP_SCENARIO_TESTCASE,
    ];
    const entries = currentZip.getEntries().map((e) => e.entryName);
    const missing = required.filter((req) => !entries.includes(req));

    if (missing.length > 0) {
      throw new Error(`Invalid workspace: missing files [${missing.join(", ")}]`);
    }

    // Thiết lập watcher
    setupWatcher(filePath, onExternalChange);

    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function saveWorkspace() {
  if (!currentZip || !currentWorkspacePath) {
    console.warn("Cannot save: no workspace is open");
    return false;
  }

  try {
    // Cập nhật thời gian sửa đổi
    const metadata = readZipFile(currentZip, TVWS_METADATA);
    metadata.lastModified = new Date().toISOString();
    writeZipFile(currentZip, TVWS_METADATA, metadata);

    // Tạm dừng watcher trước khi ghi để tránh loop
    if (fileWatcher) {
      fileWatcher.unwatch(currentWorkspacePath);
    }

    currentZip.writeZip(currentWorkspacePath);

    // Khởi động lại watcher
    if (fileWatcher) {
      fileWatcher.add(currentWorkspacePath);
    }

    return true;
  } catch (err) {
    console.error("Save workspace failed:", err);
    return false;
  }
}

function closeWorkspace() {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
  currentZip = null;
  currentWorkspacePath = null;
  console.log("Workspace closed");
}

// --- MIGRATION ---
function migrateOldStructure(zip) {
  let changed = false;

  const migrations = [
    { old: "http/config.json", new: TVWS_HTTP_SCENARIO_CONFIG },
    { old: "http/testcase.json", new: TVWS_HTTP_SCENARIO_TESTCASE },
    { old: "http/result.json", new: TVWS_HTTP_SCENARIO_RESULT },
  ];

  migrations.forEach(({ old, new: newPath }) => {
    const oldEntry = zip.getEntry(old);
    if (oldEntry) {
      zip.addFile(newPath, oldEntry.getData());
      zip.deleteFile(old);
      changed = true;
    }
  });

  if (changed) {
    try {
      const metaEntry = zip.getEntry(TVWS_METADATA);
      if (metaEntry) {
        const meta = JSON.parse(metaEntry.getData().toString());
        meta.version = "2.0";
        zip.addFile(TVWS_METADATA, Buffer.from(JSON.stringify(meta, null, 2)));
      }
    } catch (e) {
      console.error("Error updating metadata during migration:", e);
    }
  }

  return changed;
}

// --- Các hàm getter / setter khác (giữ nguyên từ code cũ của bạn) ---
function insertHttpResult(subType, test_id, test_result) {
  const resultPath = `http/${subType}/result.json`;
  let results = readZipFile(currentZip, resultPath);
  results.push({
    test_id,
    result: test_result,
    timestamp: new Date().toISOString(),
  });
  writeZipFile(currentZip, resultPath, results);
  return saveWorkspace();
}

function getAllHttpResults(suite = null) {
  if (!currentZip) throw new Error("No workspace open");
  const suites = readZipFile(currentZip, TVWS_HTTP_SCENARIO_TESTCASE);
  let resultsRaw = readZipFile(currentZip, TVWS_HTTP_SCENARIO_RESULT);

  const resultMap = {};
  resultsRaw.forEach((r) => {
    resultMap[r.test_id] = r.result;
  });

  const allResults = [];
  const targetSuites = suite ? { [suite]: suites[suite] || [] } : suites;

  Object.values(targetSuites).forEach((groups) => {
    groups.forEach((group) => {
      group.cases.forEach((caseObj) => {
        const res = resultMap[caseObj.id];
        if (res) {
          allResults.push({ ...caseObj, result: res });
        }
      });
    });
  });

  return allResults;
}

function getTestCases(suite = null, group = null) {
  if (!currentZip) throw new Error("No workspace open");
  const suites = readZipFile(currentZip, TVWS_HTTP_SCENARIO_TESTCASE);
  let targetSuites = suite ? { [suite]: suites[suite] || [] } : suites;
  const allCases = [];

  Object.values(targetSuites).forEach((groups) => {
    groups.forEach((groupObj) => {
      if (!group || groupObj.group === group) {
        allCases.push(...groupObj.cases);
      }
    });
  });

  return allCases;
}

function getTestConfig(key = null) {
  if (!currentZip) throw new Error("No workspace open");
  const config = readZipFile(currentZip, TVWS_HTTP_SCENARIO_CONFIG);
  const metadata = readZipFile(currentZip, TVWS_METADATA);

  if (key === "global") {
    return {
      max_retries: config.max_retries,
      connect_timeout: config.connect_timeout,
      read_timeout: config.read_timeout,
    };
  }

  if (key && key.startsWith("env_")) {
    const envName = key.replace("env_", "");
    const env = config.envs?.find((e) => e.name === envName);
    return env || null;
  }

  return {
    ...config,
    activeEnv: metadata.activeEnv,
  };
}

function getZipEntries() {
  if (!currentZip) throw new Error("No workspace open");
  return currentZip.getEntries().map((entry) => entry.entryName);
}

function readZipFileContent(fileName) {
  if (!currentZip) throw new Error("No workspace open");
  return readZipFile(currentZip, fileName);
}

function writeZipFileContent(fileName, content) {
  if (!currentZip) throw new Error("No workspace open");
  try {
    const parsed = JSON.parse(content);
    writeZipFile(currentZip, fileName, parsed);
    saveWorkspace();
  } catch (e) {
    throw new Error("Invalid JSON content: " + e.message);
  }
}

function getWorkspaceInfo() {
  if (!currentZip || !currentWorkspacePath) {
    return { success: false };
  }
  return {
    success: true,
    path: currentWorkspacePath,
    name: path.basename(currentWorkspacePath, ".tvws"),
  };
}

// --- EXPORT ---
module.exports = {
  // Constants
  TVWS_METADATA,
  TVWS_HTTP_SCENARIO_CONFIG,
  TVWS_HTTP_SCENARIO_TESTCASE,
  TVWS_HTTP_SCENARIO_RESULT,
  TVWS_HTTP_STRESS_INDEX,
  TVWS_HTTP_ENDURANCE_INDEX,
  TVWS_WS_INDEX,
  TVWS_SSE_INDEX,
  TVWS_GRPC_INDEX,

  // Core functions
  createWorkspaceFile,
  openWorkspaceFile,
  saveWorkspace,
  closeWorkspace,

  // Data operations
  insertHttpResult,
  getAllHttpResults,
  getTestCases,
  getTestConfig,

  // Low-level access
  getZipEntries,
  readZipFileContent,
  writeZipFileContent,
  getWorkspaceInfo,
};