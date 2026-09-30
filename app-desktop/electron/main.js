const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

// Sin este manejador, Chromium le pide permiso de camara a Electron y Electron
// no lo responde: getUserMedia queda bloqueado y el lector de QR nunca enciende
// la camara. Solo se concede 'media'; el resto sigue denegado.
const PERMISOS_CONCEDIDOS = new Set(['media']);

app.whenReady().then(() => {
  const sesion = session.defaultSession;

  sesion.setPermissionRequestHandler((_contenido, permiso, callback) => {
    callback(PERMISOS_CONCEDIDOS.has(permiso));
  });

  sesion.setPermissionCheckHandler((_contenido, permiso) => {
    return PERMISOS_CONCEDIDOS.has(permiso);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const distPath = path.join(__dirname, '..', 'dist', 'index.html');

  if (process.env.NODE_ENV === 'production' || app.isPackaged) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL(devUrl).catch(() => {
      if (fs.existsSync(distPath)) {
        mainWindow.loadFile(distPath);
      }
    });
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
