const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  guardarArchivo: (params) => ipcRenderer.invoke('guardar-archivo', params),
});