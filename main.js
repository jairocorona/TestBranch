
// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const { ejecutarAccion } = require('./acciones');
const path = require('path');



function createWindow() {
    let mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
app.on('ready', () => {
    createWindow();
});

  
ipcMain.on('execute-action', async (event, { tipo, nombreArchivo }) => {
    try {
        await ejecutarAccion(tipo, nombreArchivo);
        event.reply('action-complete', 'Acción completada correctamente');
    } catch (error) {
        console.log(error)
        event.reply('action-complete', 'Error al ejecutar la acción');
    }
});

ipcMain.on('guardar-errores-error', (event, errorMessage) => {
    dialog.showErrorBox('Error al guardar los errores Invoice', errorMessage);
});
