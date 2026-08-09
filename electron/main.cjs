const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

// Loaded on demand rather than at startup: auto-update only runs in packaged
// builds, so a missing or broken updater must never stop the app opening.
function getAutoUpdater() {
  try {
    return require("electron-updater").autoUpdater;
  } catch {
    return null;
  }
}

const isDev = process.env.ELECTRON_DEV === "true";
const DATA_FILE_NAME = "simple-list-data.json";

let writeQueue = Promise.resolve();

function getDataFilePath() {
  return path.join(app.getPath("userData"), DATA_FILE_NAME);
}

// Serialize writes so two rapid saves can never interleave on the same file.
function enqueueWrite(task) {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function readData() {
  const filePath = getDataFilePath();
  let raw;

  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    // No file yet is a normal first run; anything else is a real failure
    // and the renderer must not overwrite whatever is on disk.
    if (error.code === "ENOENT") return { ok: true, data: null };
    return { ok: false, error: error.message };
  }

  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch {
    // Unparseable file: move it aside so a fresh start doesn't destroy it.
    try {
      await fs.rename(filePath, `${filePath}.corrupt-${Date.now()}`);
    } catch {
      // If we can't even move it, starting fresh would overwrite it. Bail out.
      return { ok: false, error: "Saved data is corrupt and could not be backed up." };
    }

    return { ok: true, data: null };
  }
}

async function writeData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Invalid data payload." };
  }

  const filePath = getDataFilePath();
  const tmpPath = `${filePath}.tmp`;

  try {
    await enqueueWrite(async () => {
      await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
      await fs.rename(tmpPath, filePath);
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

let mainWindow = null;

function focusExistingWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function sendUpdateStatus(status) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("update:status", status);
}

// Updates come from GitHub Releases. electron-updater downloads in the
// background and stages the installer; the app applies it on quit, or
// straight away if the user asks.
function setupAutoUpdates() {
  if (isDev || !app.isPackaged) return;

  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) return;

  autoUpdater.on("update-available", info => sendUpdateStatus({ state: "downloading", version: info.version }));
  autoUpdater.on("download-progress", progress =>
    sendUpdateStatus({ state: "downloading", percent: Math.round(progress.percent) })
  );
  autoUpdater.on("update-downloaded", info => sendUpdateStatus({ state: "ready", version: info.version }));
  autoUpdater.on("error", error => sendUpdateStatus({ state: "error", error: String(error?.message ?? error) }));

  // A missing or unreachable release feed shouldn't take the app down.
  autoUpdater.checkForUpdates().catch(error => {
    sendUpdateStatus({ state: "error", error: String(error?.message ?? error) });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1400,
    minHeight: 500,
    backgroundColor: "#111111",
    autoHideMenuBar: true,
    ...(isDev ? { icon: path.join(__dirname, "../build/icon.ico") } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  mainWindow = win;
  win.on("closed", () => {
    mainWindow = null;
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

// Only one copy may run: a second instance would race the first one for the
// same data file. Launching again just brings the open window forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", focusExistingWindow);

  ipcMain.handle("data:load", readData);
  ipcMain.handle("data:save", (_event, data) => writeData(data));
  ipcMain.handle("update:install", () => {
    getAutoUpdater()?.quitAndInstall();
  });

  app.whenReady().then(() => {
    createWindow();
    setupAutoUpdates();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
