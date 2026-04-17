const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  minimize:  () => ipcRenderer.send('win:minimize'),
  maximize:  () => ipcRenderer.send('win:maximize'),
  close:     () => ipcRenderer.send('win:close'),
  readImage: () => ipcRenderer.invoke('fs:readImage'),
});
