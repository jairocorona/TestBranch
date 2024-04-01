
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

/*
ipcMain.on('execute-action', async (event, filePath) => {
    try {
        await ejecutarAccion(filePath);
        event.reply('action-complete', 'Acción completada correctamente');
    } catch (error) {
        console.log(error)
        event.reply('action-complete', 'Error al ejecutar la acción');
    }
});*/


/*
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const axios = require('axios');

// Función para leer los números de orden desde un archivo
function leerNumerosDeOrden(nombreArchivo) {
    try {
        const data = fs.readFileSync(nombreArchivo, 'utf8');
        return data.split('\n').map(numero => numero.trim());
    } catch (error) {
        console.error('Error al leer el archivo de las ordenes:', error);
        return [];
    }
}

// Función para enviar una solicitud HTTP con un número de orden
async function enviarSolicitud(numeroOrden, token) {
    const url = `https://stg7.shop.samsung.com/latin/cac/rest/V1/order/${numeroOrden}/invoice`;
    const payload = {
        capture: true,
        notify: false,
        appendComment: true,
        comment: {
            comment: "Invoice created by external system"
        }
    };

    const headers = {
        Authorization: `Bearer ${token}`
    };

    try {
        const response = await axios.post(url, payload, { headers });
        return response.data;
    } catch (error) {
        console.log(url)
        console.error(`Error al procesar/ enviar el número de orden ${numeroOrden}:`, error.response.data);
        console.error('Error al enviar la solicitud:', error.response ? error.response.data : error.message);
        guardarErrores(numeroOrden, error.response ? error.response.data : error.message);
        return null;
    }
}

// Función para guardar los errores en un archivo
function guardarErrores(numeroOrden, mensajeError) {
    const nombreArchivo = `${numeroOrden}_error.json`;
    const data = {
        numeroOrden: numeroOrden,
        error: mensajeError
    };
    fs.writeFileSync(nombreArchivo, JSON.stringify(data, null, 2));
    console.log(`Error para el número de orden ${numeroOrden} guardado en ${nombreArchivo}`);
}
// Función para guardar la información en un archivo
function guardarInformacion(numeroOrden, respuesta) {
    const nombreArchivo = `${numeroOrden}_respuesta.json`;
    fs.writeFileSync(nombreArchivo, JSON.stringify(respuesta, null, 2));
    console.log(`Respuesta para el número de orden ${numeroOrden} guardada en ${nombreArchivo}`);
}
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        }
    });

    mainWindow.loadURL(
        url.format({
            pathname: path.join(__dirname, 'index.html'),
            protocol: 'file:',
            slashes: true
        })
    );

    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

ipcMain.on('run-script', (event, filePath) => {
    const token = '6vjnh5h3cmf8trvje9dcz9z0gcg2hhql'; // Reemplaza 'tu_token_de_autorizacion' con tu token real
    const numerosDeOrden = leerNumerosDeOrden(filePath);
    (async () => {
        for (const numeroOrden of numerosDeOrden) {
            const respuesta = await enviarSolicitud(numeroOrden, token);
            if (respuesta) {
                guardarInformacion(numeroOrden, respuesta);
            }
        }
    })();
});
*/