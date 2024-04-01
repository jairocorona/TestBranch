// acciones.js

const axios = require('axios');
const fs = require('fs');
const path = require('path'); // Agrega esta línea para importar el módulo 'path'
const csv = require('csv-parser');
const os = require('os');
const { ipcRenderer } = require('electron');



async function leerNumerosDeOrden(nombreArchivo) {
    try {
        console.log(`Leyendo archivo: ${nombreArchivo}`);
        //const data = fs.readFileSync(nombreArchivo, 'utf8');
        const resultados = [];
        return new Promise((resolve, reject) => {
            fs.createReadStream(nombreArchivo,'utf8')
                .pipe(csv({ headers: false, delimiter: 'auto' ,cast: true,columns: true })) // Usamos el punto y coma como delimitador
                .on('data', (data) => {
                    // Accedemos al primer elemento de cada fila y lo dividimos por el punto y coma
                    const ordenes = data[0].split('auto');
                    // Convertimos cada parte en un número entero
                    const numerosDeOrden = ordenes.map((parte) => parseInt(parte, 10));
                    resultados.push(numerosDeOrden);
                })
                .on('end', () => {
                    console.log(`Lectura de archivo completada.`);
                    resolve(resultados);
                })
                .on('error', (error) => {
                    console.error(`Error al leer el archivo: ${error}`);
                    reject(error);
                });
        });
    } catch (error) {
        console.error('Error general al leer el archivo:', error);
        return [];
    }
}


let errores = [];

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
    console.log('Payload a enviar:', payload);
    try {
        console.log(`Enviando solicitud para el número de orden ${numeroOrden} a la URL: ${url}`);
        console.log('Payload a enviar:', payload);
        const headers = {
            Authorization: `Bearer ${token}`
        };
        const response = await axios.post(url, payload, { headers });
        console.log(`Respuesta recibida para el número de orden ${numeroOrden}:`, response.data);
        
        return response.data;
    } catch (error) {
        console.error(`Error al procesar/enviar la solicitud para el número de orden ${numeroOrden}:`, error.response ? error.response.data : error.message);
        console.error(`Error al procesar/ enviar el número de orden ${numeroOrden}:`, error.response.data);
        console.error('Error al enviar la solicitud:', error.response ? error.response.data : error.message);
        errores.push({ numeroOrden, mensaje: error.response ? error.response.data : error.message });
        return null;
    }
}



async function leerNumerosDeOrdenShipment(nombreArchivo) {
    try {
        console.log(`Leyendo archivo: ${nombreArchivo}`);
        const resultados = [];
        return new Promise((resolve, reject) => {
            fs.createReadStream(nombreArchivo, 'utf8')
                .pipe(csv({ headers: false, delimiter: 'auto', cast: true, columns: true }))
                .on('data', (data) => {
                    const partes = data['0'].split(';');
                    const numeroOrden = parseInt(partes[0], 10);
                    const idItem = parseInt(partes[1], 10);
                    const cantidad = parseInt(partes[2], 10);
                    resultados.push({ numeroOrden, idItem, cantidad });
                })
                .on('end', () => {
                    console.log(`Lectura de archivo completada.`);
                    resolve(resultados);
                })
                .on('error', (error) => {
                    console.error(`Error al leer el archivo: ${error}`);
                    reject(error);
                });
        });
    } catch (error) {
        console.error('Error general al leer el archivo:', error);
        return [];
    }
}


async function enviarSolicitudShip(numerosDeOrden, token) {
    const urlBase = 'https://stg7.shop.samsung.com/latin/cac/rest/V1/order/';
    const payloadBase = {
        appendComment: true,
        comment: {
            comment: 'Shipment created by an external system'
        },
        tracks: [
            {
                track_number: '1Y-9876543210',
                title: 'Custom Service',
                carrier_code: 'custom'
            }
        ]
    };
    const headers = {
        Authorization: `Bearer ${token}`
    };

    try {
        const errores = [];

        // Agrupar los datos por número de orden
        const ordenesAgrupadas = {};
        for (const datosDeOrden of numerosDeOrden) {
            const numeroOrden = datosDeOrden.numeroOrden;
            if (!ordenesAgrupadas[numeroOrden]) {
                ordenesAgrupadas[numeroOrden] = {
                    numeroOrden: numeroOrden,
                    idItems: [],
                    cantidades: []
                };
            }
            ordenesAgrupadas[numeroOrden].idItems.push(datosDeOrden.idItem);
            ordenesAgrupadas[numeroOrden].cantidades.push(datosDeOrden.cantidad);
        }

        // Enviar las solicitudes agrupadas y las individuales
        for (const orden in ordenesAgrupadas) {
            const datosOrden = ordenesAgrupadas[orden];
            const url = `${urlBase}${datosOrden.numeroOrden}/ship`;
            console.log(`Enviando solicitud para el número de orden ${datosOrden.numeroOrden} a la URL: ${url}`);

            // Verificar si hay elementos en el grupo antes de enviar la solicitud
            if (datosOrden.idItems.length > 0) {
                // Construir la lista de items con idItem y cantidad
                const items = datosOrden.idItems.map((idItem, index) => ({
                    order_item_id: idItem,
                    qty: datosOrden.cantidades[index]
                }));

                // Clonar el payloadBase y agregar los items
                const payload = { ...payloadBase, items };

                // Imprimir el payload a enviar
                console.log('Payload a enviar:', payload);

                // Enviar la solicitud HTTP
                try {
                    const response = await axios.post(url, payload, { headers });
                    // Guardar la información de la respuesta
                    guardarInformacionShipment(datosOrden.numeroOrden, response.data);
                } catch (error) {
                    console.error(`Error al enviar la solicitud para el número de orden ${datosOrden.numeroOrden}:`, error.response ? error.response.data : error.message);
                    errores.push({ numeroOrden: datosOrden.numeroOrden, error: error.response ? error.response.data : error.message });
                }
            } else {
                console.log(`No hay elementos para enviar para el número de orden ${datosOrden.numeroOrden}`);
            }
        }

        // Guardar los errores después de completar todas las solicitudes
        if (errores.length > 0) {
            guardarErroresShip(errores);
        }
    } catch (error) {
        console.error('Error general al enviar las solicitudes:', error);
        // Reemplaza 'guardarErroresShip' con la función o el código correcto para manejar el error aquí
    }
}

async function ejecutarAccion(tipo, nombreArchivo) {
    const token = '6vjnh5h3cmf8trvje9dcz9z0gcg2hhql'; // Reemplaza 'tu_token_de_autorizacion' con tu token real
  
    let numerosDeOrden;
    if (tipo === 'invoice') {
        numerosDeOrden = await leerNumerosDeOrden(nombreArchivo);
        if (!numerosDeOrden) {
            console.log('Error al leer el archivo CSV');
            return;
        }

        try {
            const totalOrdenes = numerosDeOrden.length;
            let ordenesProcesadas = 0;

            for (const numeroOrden of numerosDeOrden) {
                const respuesta = await enviarSolicitud(numeroOrden, token);
                console.log('Números de orden procesados:', numeroOrden);
                if (respuesta) {
                    guardarInformacion(numeroOrden, respuesta);
                }
                ordenesProcesadas++;
                const progreso = (ordenesProcesadas / totalOrdenes) * 100;
                if (typeof ipcRenderer !== 'undefined') {
                    ipcRenderer.send('progress-update', progreso);
                }   
                
            }
        } catch (error) {
            console.error('Error al procesar la solicitud:', error);
            guardarErrores([error]);
        }
    } else if (tipo === 'shipment') {
        // Resto del código para tipo 'shipment'
        numerosDeOrden = await leerNumerosDeOrdenShipment(nombreArchivo);
        if (!numerosDeOrden) {
            console.log('Error al leer el archivo CSV');
            return;
        }
        try {
            const totalOrdenes = numerosDeOrden.length;
            let ordenesProcesadas = 0;
            await enviarSolicitudShip(numerosDeOrden, token);
            for (const numeroOrden of numerosDeOrden) {
                // Lógica para enviar la solicitud de shipment
                ordenesProcesadas++;
                
                const progreso = (ordenesProcesadas / totalOrdenes) * 100;
                if (typeof ipcRenderer !== 'undefined') {
                    ipcRenderer.send('progress-update', progreso);
                }
            }
        } catch (error) {
            console.error('Error al procesar la solicitud de shipment:', error);
            guardarErroresShip([error]);
        }
    } else {
        console.error('Tipo de acción no válido:', tipo);
    }
}


/*
async function ejecutarAccion(tipo, nombreArchivo) {
    const token = '6vjnh5h3cmf8trvje9dcz9z0gcg2hhql'; // Reemplaza 'tu_token_de_autorizacion' con tu token real
  
    let numerosDeOrden;
    if (tipo === 'invoice') {
        numerosDeOrden = await leerNumerosDeOrden(nombreArchivo);
        if (!numerosDeOrden) {
            console.log('Error al leer el archivo CSV');
            return;
        }

        try {
            for (const numeroOrden of numerosDeOrden) {
                const respuesta = await enviarSolicitud(numeroOrden, token);
                console.log('Números de orden procesados:', numeroOrden);
                if (respuesta) {
                    guardarInformacion(numeroOrden, respuesta);
                }
            }
        } catch (error) {
            console.error('Error al procesar la solicitud:', error);
            guardarErrores([error]);
        }
    } else if (tipo === 'shipment') {
        numerosDeOrden = await leerNumerosDeOrdenShipment(nombreArchivo);
        if (!numerosDeOrden) {
            console.log('Error al leer el archivo CSV');
            return;
        }

        try {
            await enviarSolicitudShip(numerosDeOrden, token);
        } catch (error) {
            console.error('Error al procesar la solicitud de shipment:', error);
            guardarErroresShip([error]);
        }
    } else {
        console.error('Tipo de acción no válido:', tipo);
    }
}










async function ejecutarAccion(tipo, nombreArchivo) {
    const token = '6vjnh5h3cmf8trvje9dcz9z0gcg2hhql'; // Reemplaza 'tu_token_de_autorizacion' con tu token real
  
    let numerosDeOrden;
    if (tipo === 'invoice') {
        numerosDeOrden = await leerNumerosDeOrden(nombreArchivo);
        const errores = [];

        try {
            for (const numeroOrden of numerosDeOrden) {
                const respuesta = await enviarSolicitud(numeroOrden, token);
                console.log('Números de orden procesados:', numeroOrden);
                if (respuesta) {
                    guardarInformacion(numeroOrden, respuesta);
                }
            }
        } catch (error) {
            console.error('Error al procesar la solicitud:', error);
            errores.push(error);
        }
        
        guardarErrores(errores);
    } else if (tipo === 'shipment') {
        numerosDeOrden = await leerNumerosDeOrdenShipment(nombreArchivo);
        const errores = [];

        try {
            
            let respuesta = await enviarSolicitudShip(numerosDeOrden, token);
            console.log('Números de orden procesados:', numerosDeOrden);
            if (respuesta) {
                guardarInformacionShipment(numerosDeOrden, respuesta);
            }
        } catch (error) {
            console.error('Error al procesar la solicitud:', error);
            errores.push(error);
        }
        
        guardarErroresShip(errores);
    } else {
        console.error('Tipo de acción no válido:', tipo);
    }
}






/*
async function ejecutarAccion(tipo, nombreArchivo) {
    const token = '6vjnh5h3cmf8trvje9dcz9z0gcg2hhql'; // Reemplaza 'tu_token_de_autorizacion' con tu token real
  
    let numerosDeOrden;
    if (tipo === 'invoice') {
        numerosDeOrden = await leerNumerosDeOrden(nombreArchivo);
    } else if (tipo === 'shipment') {
        numerosDeOrden = await leerNumerosDeOrdenShipment(nombreArchivo);
    }

    if (!numerosDeOrden) {
        console.log('Error al leer el archivo CSV');
        return;
    }

    const errores = [];

    try {
        let respuesta;
        if (tipo === 'invoice') {
            respuesta = await enviarSolicitud(numerosDeOrden, token);
        } else if (tipo === 'shipment') {
            respuesta = await enviarSolicitudShip(numerosDeOrden, token);
        }
        
        console.log('Números de orden procesados:', numerosDeOrden);
        
        if (respuesta) {
            if (tipo === 'invoice') {
                guardarInformacion(numerosDeOrden, respuesta);
            } else if (tipo === 'shipment') {
                guardarInformacionShipment(numerosDeOrden, respuesta);
            }
        }
    } catch (error) {
        console.error('Error al procesar la solicitud:', error);
        errores.push(error);
    }
    
    guardarErrores(errores);
}





/*
async function ejecutarAccion(nombreArchivo) {
    const token = '6vjnh5h3cmf8trvje9dcz9z0gcg2hhql'; // Reemplaza 'tu_token_de_autorizacion' con tu token real
  
    const numerosDeOrden = await leerNumerosDeOrden(nombreArchivo);
    for (const numeroOrden of numerosDeOrden) {
        const respuesta = await enviarSolicitud(numeroOrden, token); // Asegúrate de pasar correctamente numeroOrden
        console.log('Números de orden procesados:', numerosDeOrden);
        if (respuesta) {
            
            guardarInformacion(numeroOrden, respuesta);
        }
    }
    guardarErrores(errores);
}

function guardarErrores(numeroOrden, mensajeError) {
    const nombreArchivo = path.join(__dirname, `${numeroOrden}_error.json`);
    const data = {
        numeroOrden: numeroOrden,
        error: mensajeError
    };
    fs.writeFileSync(nombreArchivo, JSON.stringify(data, null, 2));
    console.log(`Error para el número de orden ${numeroOrden} guardado en ${nombreArchivo}`);
}*/
function obtenerRutaEscritorio() {
    return path.join(os.homedir(), 'Desktop');
}

function guardarErroresShip(errores, mensajeError) {
    const nombreArchivo = path.join(obtenerRutaEscritorio(), 'erroresShipment.json');
    const data = {
        errores: errores,
        mensajeError: mensajeError
    };
    fs.writeFileSync(nombreArchivo, JSON.stringify(data, null, 2));
    console.log(`Errores de Shipment guardados en ${nombreArchivo}`);
}

function guardarInformacionShipment(numeroOrden, respuesta) {
    const nombreArchivo = path.join(obtenerRutaEscritorio(), `GuardarShipment_${numeroOrden}.json`);
    fs.writeFileSync(nombreArchivo, JSON.stringify(respuesta, null, 2));
    console.log(`Respuesta para el número de orden ${numeroOrden} guardada en ${nombreArchivo}`);
}



function guardarErrores(errores) {
    const nombreArchivo = path.join(obtenerRutaEscritorio(), 'erroresInvoice.json');
    console.log("Ruta?"+nombreArchivo)
    console.log("Errores"+errores)
    fs.writeFileSync(nombreArchivo, JSON.stringify(errores, null, 2));
    console.log(`Errores guardados en ${nombreArchivo}`);
}

function guardarInformacion(numeroOrden, respuesta) {
    const nombreArchivo = path.join(obtenerRutaEscritorio(), 'GuardarInvoice.json');
    fs.writeFileSync(nombreArchivo, JSON.stringify(respuesta, null, 2));
    console.log(`Respuesta para el número de orden ${numeroOrden} guardada en ${nombreArchivo}`);
}

module.exports = { ejecutarAccion };

