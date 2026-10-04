const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
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

  // Manejador para guardar archivos (boletas, tickets, etc.) permitiendo
  // al usuario elegir la ubicación y nombre en el sistema de archivos nativo.
  ipcMain.handle('guardar-archivo', async (_event, { nombreSugerido, extension, dataBase64 }) => {
    const focusedWin = BrowserWindow.getFocusedWindow();
    const ext = extension || 'pdf';
    const { canceled, filePath } = await dialog.showSaveDialog(focusedWin, {
      title: 'Guardar Boleta',
      defaultPath: nombreSugerido || `boleta.${ext}`,
      filters: [
        { name: ext.toUpperCase(), extensions: [ext] },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
    });

    if (canceled || !filePath) {
      return { cancelado: true };
    }

    const buffer = Buffer.from(dataBase64, 'base64');
    await fs.promises.writeFile(filePath, buffer);
    return { cancelado: false, filePath };
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
