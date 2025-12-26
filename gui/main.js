const { app, BrowserWindow, ipcMain, dialog, globalShortcut, Notification } = require("electron");
const path = require("path");
const workspaceManager = require("./controller/workspaceManager");
const httpController = require("./controller/httpController");

let mainWin;
let currentWorkspaceName = "Unknown Workspace";

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1300,
    minWidth: 800,
    height: 700,
    minHeight: 400,
    frame: false,
    icon: path.join(__dirname, "resources", "static", "assets", "main", "tunview_logo_img.png"),
    backgroundColor: "#000000ff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWin.loadFile("resources/static/gui_version_2/html/main/tunview.html");
  ipcMain.on("window-minimize", () => mainWin.minimize());
  ipcMain.on("window-maximize", () => {
    mainWin.isMaximized() ? mainWin.unmaximize() : mainWin.maximize();
  });
  ipcMain.on("window-close", () => mainWin.close());
}
ipcMain.handle("show-open-dialog", async (event, options) => {
  const result = await dialog.showOpenDialog(mainWin, options);
  return result;
});
ipcMain.on("create-workspace-file", (event, data) => {
  const result = workspaceManager.createWorkspaceFile(data.folderPath, data.name);
  if (result.success) {
    currentWorkspaceName = data.name;
    console.log("Workspace created:", result.path);
    event.reply("workspace-created", { name: data.name, path: result.path });
  } else {
    console.error("Error:", result.error);
    event.reply("workspace-error", { message: result.error.message });
  }
});
ipcMain.handle("import-workspace-file", async (event) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWin, {
      properties: ["openFile"],
      filters: [{ name: "Tunview Workspace", extensions: ["tvws"] }],
    });
    if (canceled || filePaths.length === 0) return { success: false, error: "No file selected" };
    const filePath = filePaths[0];
    const result = workspaceManager.openWorkspaceFile(filePath);
    if (result.success) {
      currentWorkspaceName = path.basename(filePath, ".tvws");
      return { success: true, path: filePath, name: path.basename(filePath, ".tvws") };
    } else {
      return { success: false, error: result.error.message };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle("get-zip-entries", async (event) => {
  try {
    const entries = workspaceManager.getZipEntries();
    return entries;
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle("read-zip-file", async (event, arg) => { 
  try {
    const fileName = (typeof arg === 'object' && arg.fileName) ? arg.fileName : arg;
    const content = workspaceManager.readZipFileContent(fileName);
    return content;
  } catch (err) {
    throw new Error(err.message);
  }
});
ipcMain.handle("write-zip-file", async (event, { fileName, content }) => {
  try {
    const dataToSave = typeof content === "object" ? JSON.stringify(content, null, 2) : content;
    workspaceManager.writeZipFileContent(fileName, dataToSave);
    return { success: true };
  } catch (err) {
    throw new Error(err.message);
  }
});
ipcMain.handle("get-workspace-info", async (event) => {
  return workspaceManager.getWorkspaceInfo();
});
ipcMain.handle("get-test-config", async (event) => {
  try {
    return workspaceManager.getTestConfig();
  } catch (err) {
    throw new Error(err.message);
  }
});
ipcMain.handle("run-http-testcases", async (event, testcases, globalConfig) => {
  const onUpdate = (msg) => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send("http-run-update", msg);
    }
  };
  try {
    const results = await httpController.runTestcasesSequentially(testcases, globalConfig, onUpdate);
    const workspaceInfo = workspaceManager.getWorkspaceInfo();
    const wsName = workspaceInfo ? workspaceInfo.name : "Unknown Workspace";
    if (Notification.isSupported()) {
      new Notification({
        title: `Tunview Scenario Testing Finished`,
        body: `Finished ${testcases.length} testcases in workspace: ${currentWorkspaceName}`,
        icon: path.join(__dirname, "resources", "static", "assets", "main", "tunview_logo_img.png")
      }).show();
    }
    return { success: true, results };
  } catch (err) {
    console.error("[Main] Test Run Error:", err.message);
    if (Notification.isSupported()) {
      new Notification({
        title: "Tunview Scenario Test Error",
        body: `Error in ${currentWorkspaceName} : ${err.message}`
      }).show();
    }
    return { success: false, error: err.message };
  }
});
ipcMain.handle("stop-http-testcases", async (event) => {
  console.log("[Main] Received request to stop HTTP Core Process...");

  try {
    const success = httpController.stopCoreProcess();

    if (success) {
      console.log("[Main] HTTP Core Process terminated successfully.");
      return { success: true, message: "HTTP Core Process terminated." };
    } else {
      console.log("[Main] No HTTP Core Process was running.");
      return { success: false, message: "No HTTP Core Process was running." };
    }
  } catch (error) {
    console.error("[Main] Error while stopping HTTP Core:", error.message);
    return { success: false, message: `Error stopping core: ${error.message}` };
  }
});
app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId("Tunview");
  }
  createWindow();
  globalShortcut.register("CommandOrControl+I", () => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.toggleDevTools();
    }
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  workspaceManager.closeWorkspace();
  if (process.platform !== "darwin") app.quit();
});
ipcMain.handle("export-report-file", async (event, { fileName, content }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWin, {
      title: "Export Test Report",
      defaultPath: fileName,
      filters: [
        { name: "HTML Files", extensions: ["html"] },
        { name: "All Files", extensions: ["*"] }
      ],
    });

    if (canceled || !filePath) {
      return { success: false, error: "Export canceled" };
    }

    const fs = require("fs");
    fs.writeFileSync(filePath, content, "utf-8");
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle("get-path-constants", () => {
  return {
    TVWS_METADATA                 : workspaceManager.TVWS_METADATA,
    TVWS_HTTP_SCENARIO_TESTCASE   : workspaceManager.TVWS_HTTP_SCENARIO_TESTCASE,
    TVWS_HTTP_SCENARIO_CONFIG     : workspaceManager.TVWS_HTTP_SCENARIO_CONFIG,
    TVWS_HTTP_SCENARIO_RESULT     : workspaceManager.TVWS_HTTP_SCENARIO_RESULT,
    TVWS_HTTP_STRESS_INDEX        : workspaceManager.TVWS_HTTP_STRESS_INDEX,
    TVWS_HTTP_ENDURANCE_INDEX     : workspaceManager.TVWS_HTTP_ENDURANCE_INDEX,
    TVWS_WS_INDEX                 : workspaceManager.TVWS_WS_INDEX,
    TVWS_SSE_INDEX                : workspaceManager.TVWS_SSE_INDEX,
    TVWS_GRPC_INDEX               : workspaceManager.TVWS_GRPC_INDEX
  };
});