const { contextBridge, ipcRenderer } = require("electron");
window.addEventListener("DOMContentLoaded", () => {
  console.log("Preload loaded!");
});
contextBridge.exposeInMainWorld("winAPI", {
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
});
contextBridge.exposeInMainWorld("ipcAPI", {
  send: (channel, ...data) => ipcRenderer.send(channel, ...data),
  invoke: (channel, ...data) => ipcRenderer.invoke(channel, ...data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
});
