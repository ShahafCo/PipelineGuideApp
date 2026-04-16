const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  minimize:   ()      => ipcRenderer.send('win:minimize'),
  maximize:   ()      => ipcRenderer.send('win:maximize'),
  close:      ()      => ipcRenderer.send('win:close'),
  readKey:    ()      => ipcRenderer.invoke('fs:readKey'),
  readImage:  ()      => ipcRenderer.invoke('fs:readImage'),
  connect:    cfg     => ipcRenderer.invoke('ssh:connect', cfg),
  exec:       cmd     => ipcRenderer.invoke('ssh:exec', cmd),
  stream:     cmd     => ipcRenderer.invoke('ssh:stream', cmd),
  disconnect:  ()           => ipcRenderer.invoke('ssh:disconnect'),
  tunnelOpen:  remotePort  => ipcRenderer.invoke('tunnel:open', remotePort),
  tunnelClose: ()           => ipcRenderer.invoke('tunnel:close'),
  onData:      cb           => ipcRenderer.on('ssh:data', (_, d) => cb(d)),
  onDone:     cb      => ipcRenderer.on('ssh:done', () => cb()),
  offAll:     ()      => { ipcRenderer.removeAllListeners('ssh:data'); ipcRenderer.removeAllListeners('ssh:done'); }
});
