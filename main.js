const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const { Client } = require('ssh2');

let win, conn = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 620,
    frame: false, backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });

ipcMain.on('win:minimize', () => win.minimize());
ipcMain.on('win:maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.on('win:close',    () => { if (conn) conn.end(); app.quit(); });

ipcMain.handle('fs:readKey', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Private Key', extensions: ['pem', 'key', 'ppk', '*'] }]
  });
  return r.canceled ? null : fs.readFileSync(r.filePaths[0], 'utf8');
});

ipcMain.handle('fs:readImage', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] }]
  });
  if (r.canceled) return null;
  const filePath = r.filePaths[0];
  const data = fs.readFileSync(filePath).toString('base64');
  const ext  = path.extname(filePath).slice(1).toLowerCase();
  const mime = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml', bmp:'image/bmp' }[ext] || 'image/png';
  return { data, mime, name: path.basename(filePath) };
});

// ── SSH connection ────────────────────────────────────────────────────────────
ipcMain.handle('ssh:connect', (_, cfg) => new Promise(resolve => {
  if (conn) { conn.end(); conn = null; }
  const c = new Client();
  c.on('ready', () => { conn = c; resolve({ ok: true }); });
  c.on('error', e => resolve({ ok: false, error: e.message }));
  const opts = { host: cfg.host, port: cfg.port || 22, username: cfg.username, readyTimeout: 12000 };
  if (cfg.privateKey) { opts.privateKey = cfg.privateKey; if (cfg.passphrase) opts.passphrase = cfg.passphrase; }
  else opts.password = cfg.password;
  c.connect(opts);
}));

ipcMain.handle('ssh:exec', (_, cmd) => new Promise(resolve => {
  if (!conn) return resolve({ ok: false, error: 'Not connected' });
  conn.exec(cmd, (err, stream) => {
    if (err) return resolve({ ok: false, error: err.message });
    let out = '', err2 = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => err2 += d);
    stream.on('close', code => resolve({ ok: true, stdout: out, stderr: err2, code }));
  });
}));

ipcMain.handle('ssh:stream', (_, cmd) => new Promise(resolve => {
  if (!conn) return resolve({ ok: false, error: 'Not connected' });
  conn.exec(cmd, (err, stream) => {
    if (err) return resolve({ ok: false, error: err.message });
    resolve({ ok: true });
    stream.on('data',        d => win.webContents.send('ssh:data', d.toString()));
    stream.stderr.on('data', d => win.webContents.send('ssh:data', `\x1b[31m${d}\x1b[0m`));
    stream.on('close',       () => win.webContents.send('ssh:done'));
  });
}));

ipcMain.handle('ssh:disconnect', () => { if (conn) { conn.end(); conn = null; } return { ok: true }; });

// ── SSH tunnel for API mode ────────────────────────────────────────────────────
// Opens a local TCP listener that forwards through the active SSH connection
// to the guide server running on the remote's loopback (127.0.0.1:remotePort).
let tunnelServer = null;
let tunnelPort   = null;

ipcMain.handle('tunnel:open', (_, remotePort) => new Promise((resolve) => {
  if (!conn) return resolve({ ok: false, error: 'Not connected' });
  if (tunnelServer) { resolve({ ok: true, port: tunnelPort }); return; }

  const net = require('net');
  const server = net.createServer(local => {
    conn.forwardOut('127.0.0.1', 0, '127.0.0.1', remotePort, (err, remote) => {
      if (err) {
        win.webContents.send('ssh:data', `\x1b[31mTunnel forward error: ${err.message}\x1b[0m`);
        local.destroy();
        return;
      }
      local.pipe(remote);
      remote.pipe(local);
      local.on('close', () => remote.destroy());
      remote.on('close', () => local.destroy());
      local.on('error',  () => remote.destroy());
      remote.on('error', () => local.destroy());
    });
  });

  server.listen(0, '127.0.0.1', () => {
    tunnelServer = server;
    tunnelPort   = server.address().port;
    resolve({ ok: true, port: tunnelPort });
  });
  server.on('error', err => resolve({ ok: false, error: err.message }));
}));

ipcMain.handle('tunnel:close', () => {
  if (tunnelServer) { tunnelServer.close(); tunnelServer = null; tunnelPort = null; }
  return { ok: true };
});
