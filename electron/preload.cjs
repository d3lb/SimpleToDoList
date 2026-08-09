const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("simpleListStorage", {
  load: () => ipcRenderer.invoke("data:load"),
  save: data => ipcRenderer.invoke("data:save", data)
});

contextBridge.exposeInMainWorld("simpleListUpdater", {
  onStatus: callback => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on("update:status", handler);

    return () => ipcRenderer.removeListener("update:status", handler);
  },
  install: () => ipcRenderer.invoke("update:install")
});
