// acciones.js

const axios = require('axios');
const fs = require('fs');
const path = require('path'); // Agrega esta línea para importar el módulo 'path'
const csv = require('csv-parser');
const { ipcRenderer } = require('electron');
const { parse } = require('json2csv');
const { dialog } = require('electron');


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
        console.error(`Error al procesar/enviar la solicitud para el numero de orden ${numeroOrden}:`, error.response ? error.response.data : error.message);
        console.error(`Error al procesar/ enviar el numero de orden ${numeroOrden}:`, error.response.data);
        console.error('Error al enviar la solicitud:', error.response ? error.response.data : error.message);
        errores.push({ numeroOrden, mensaje: error.response ? error.response.data : error.message });

    }
}


let erroresEntity = [];

async function enviarSolicitudEntity(numeroOrden, token,comment, customerNotified, visibleFront, status) {

    const url = `https://shop.samsung.com/latin/cac/rest/V1/orders/${numeroOrden}/comments`;
    const payload = {
        statusHistory: {
            comment: comment,
            is_customer_notified: customerNotified,
            is_visible_on_front: visibleFront,
            status: status
        }
    };
    //console.log('Payload a enviar:', payload);
    try {
       // console.log(`Enviando solicitud para el número de orden ${numeroOrden} a la URL: ${url}`);
        //console.log('Payload a enviar:', payload);
        const headers = {
            Authorization: `Bearer ${token}`
        };
        const response = await axios.post(url, payload, { headers });
        console.log(`Respuesta recibida para el número de orden ${numeroOrden}:`, response);

        return response.data;
    } catch (error) {
        //console.error(`Error al procesar/enviar la solicitud para el numero de orden ${numeroOrden}:`, error.response ? error.response.data : error.message);
       // console.error(`Error al procesar/ enviar el numero de orden ${numeroOrden}:`, error.response.data);
        console.error('Error al enviar la solicitud:', error.response ? error.response.data : error.message);
        erroresEntity.push({ numeroOrden, mensaje: error.response ? error.response.data : error.message });

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

async function ejecutarAccion(tipo, nombreArchivo, comment, customerNotified, visibleFront, status) {
    const token = '6vjnh5h3cmf8trvje9dcz9z0gcg2hhql'; // Reemplaza 'tu_token_de_autorizacion' con tu token real
    errores = [];
    erroresEntity = [];
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
            guardarErrores(errores)
            errores = [];
        } catch (error) {
            //console.error('Error al procesar la solicitud:', error);
            //guardarErrores(error)
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
    }else if (tipo === 'entity'){

        numerosDeOrden = await leerNumerosDeOrden(nombreArchivo);
        if (!numerosDeOrden) {
            console.log('Error al leer el archivo CSV');
            return;
        }

        try {
            const totalOrdenes = numerosDeOrden.length;
            let ordenesProcesadas = 0;
            for (const numeroOrden of numerosDeOrden) {

                const respuesta = await enviarSolicitudEntity(numeroOrden, token, comment, customerNotified, visibleFront, status);
                console.log('Números de orden procesados:', numeroOrden);
                if (respuesta) {
                    guardarInformacionEntity(numeroOrden, respuesta);
                }

                ordenesProcesadas++;
                const progreso = (ordenesProcesadas / totalOrdenes) * 100;
                if (typeof ipcRenderer !== 'undefined') {

                    ipcRenderer.send('progress-update', progreso);
                }

            }
            guardarErroresEntity(erroresEntity)
            erroresEntity = [];
        } catch (error) {
            console.error('Error al procesar la solicitud:', error);
            guardarErroresEntity(errores)
        }


    }else {
        console.error('Tipo de acción no válido:', tipo);
    }
}


function obtenerRutaEscritorio() {
    return 'C:\\Errores';
}
function obtenerRutaGuardado() {
    return 'C:\\Enviado';
}


function guardarErroresShip(errores, mensajeError) {
    const nombreArchivo = 'erroresShipment.csv';
    const rutaErrores = obtenerRutaEscritorio();
    const rutaCompleta = path.join(rutaErrores, nombreArchivo);

    // Verificar si la carpeta de errores existe
    if (!fs.existsSync(rutaErrores)) {
        // Si no existe, la creamos
        fs.mkdirSync(rutaErrores);
        console.log(`Carpeta de errores creada en ${rutaErrores}`);
    }

    // Crear el contenido CSV a partir de los errores
    const fields = ['Error', 'Descripción'];
    const csv = parse(errores.map(error => ({ 'Error': error, 'Descripción': mensajeError })), { fields });
    const separatorRow = '\n//////////////////////////////////////////////////\n';
    try {
        // Verificar si el archivo ya existe
        if (fs.existsSync(rutaCompleta)) {
            // Si existe, modificar el archivo
            fs.appendFileSync(rutaCompleta, csv);
            console.log(`Errores de Shipment agregados a ${rutaCompleta}`);
        } else {
            // Si no existe, crear uno nuevo
            fs.writeFileSync(rutaCompleta, csv);
            console.log(`Errores de Shipment guardados en ${rutaCompleta}`);
        }
        fs.appendFileSync(rutaCompleta, separatorRow);
    } catch (error) {
        console.error('Error al guardar los errores:', error);
        dialog.showErrorBox('Error al guardar los errores Shipment\nVerificar si el archivo de errores se encuentra abierta', error.message);
    }
}


function guardarInformacionShipment(numeroOrden, respuesta) {
    const nombreArchivo = 'RespuestasAPIShipment.csv';
    const rutaGuardado = obtenerRutaGuardado();
    const rutaCompleta = path.join(rutaGuardado, nombreArchivo);
    //const nombreArchivo = path.join(obtenerRutaGuardado(), 'RespuestasAPI.csv');
    const fields = ['Numero de Orden', 'Respuesta'];
    const separatorRow = '\n//////////////////////////////////////////////////\n';
    // Verificar si la carpeta de errores existe
    if (!fs.existsSync(rutaGuardado)) {
        // Si no existe, la creamos
        fs.mkdirSync(rutaGuardado);
        console.log(`Carpeta de errores creada en ${rutaGuardado}`);
    }
    // Convertir la respuesta en una cadena de texto separada por comas
    const respuestaFormateada = respuesta.toString(); // Esto es un ejemplo, podrías ajustarlo según el tipo de respuesta

    // Crear la línea de contenido CSV
    const csvContent = `${numeroOrden},${respuestaFormateada}\n`;

    try {
        // Verificar si el archivo ya existe
        if (fs.existsSync(rutaCompleta)) {
            // Si existe, agregar al archivo
            fs.appendFileSync(rutaCompleta, csvContent);
            console.log(`Respuesta para el número de orden ${numeroOrden} agregada a ${rutaCompleta}`);
           // fs.appendFileSync(rutaCompleta, separatorRow);
        } else {
            // Si no existe, crear uno nuevo con los encabezados
            fs.writeFileSync(rutaCompleta, `${fields.join(',')}\n${csvContent}`);
            console.log(`Respuesta para el número de orden ${numeroOrden} guardada en ${rutaCompleta}`);
        }
        fs.appendFileSync(rutaCompleta, separatorRow);
    } catch (error) {
        console.error('Error al guardar la respuesta del API Shipment:', error);
    }
}


function guardarErrores(errores) {
       
    const nombreArchivo = 'erroresInvoice.csv';
    const rutaErrores = obtenerRutaEscritorio();
    const rutaCompleta = path.join(rutaErrores, nombreArchivo);
    console.log("//*************************Entro a la funcion invoice" , errores)
    // Verificar si la carpeta de errores existe
    if (!fs.existsSync(rutaErrores)) {
        // Si no existe, la creamos
        fs.mkdirSync(rutaErrores);
        console.log(`Carpeta de errores creada en ${rutaErrores}`);
    }

    // Crear el contenido CSV a partir de los errores
    const fields = ['Numero de Orden', 'Mensaje de Error'];
    const csvContent = parse(errores.map(error => ({ 'Numero de Orden': error.numeroOrden, 'Mensaje de Error': error.mensaje })), { fields });
    const separatorRow = '\n//////////////////////////////////////////////////\n';
    try {
        // Verificar si el archivo ya existe
        if (fs.existsSync(rutaCompleta)) {
            // Si existe, modificar el archivo
            
            fs.appendFileSync(rutaCompleta, csvContent);
            
            console.log(`Errores de Invoice agregados a ${rutaCompleta}`);
        } else {
            // Si no existe, crear uno nuevo
            fs.writeFileSync(rutaCompleta, csvContent);
            console.log(`Errores de Invoice guardados en ${rutaCompleta}`);
        }
        
        fs.appendFileSync(rutaCompleta, separatorRow);
    } catch (error) {
        
        console.error('Error al guardar los errores Invoice:', error);
        dialog.showErrorBox('Error al guardar los errores Invoice\nVerificar si el archivo de errores se encuentra abierta', error.message);
        
    }

}


function guardarErroresEntity(erroresEntity) {

    const nombreArchivo = 'erroresEntity.csv';
    const rutaErrores = obtenerRutaEscritorio();
    const rutaCompleta = path.join(rutaErrores, nombreArchivo);
    console.log("//*************************Entro a la funcion entity" , erroresEntity)
    // Verificar si la carpeta de errores existe
    if (!fs.existsSync(rutaErrores)) {
        // Si no existe, la creamos
        fs.mkdirSync(rutaErrores);
        console.log(`Carpeta de errores creada en ${rutaErrores}`);
    }

    // Crear el contenido CSV a partir de los errores
    const fields = ['Numero de Orden', 'Mensaje de Error'];
    const csvContent = parse(erroresEntity.map(error => ({ 'Numero de Orden': error.numeroOrden, 'Mensaje de Error': error.mensaje })), { fields });
    const separatorRow = '\n//////////////////////////////////////////////////\n';
    try {
        // Verificar si el archivo ya existe
        if (fs.existsSync(rutaCompleta)) {
            // Si existe, modificar el archivo
            
            fs.appendFileSync(rutaCompleta, csvContent);
            
            console.log(`Errores de entity agregados a ${rutaCompleta}`);
        } else {
            // Si no existe, crear uno nuevo
            fs.writeFileSync(rutaCompleta, csvContent);
            console.log(`Errores de entity guardados en ${rutaCompleta}`);
        }
        
        fs.appendFileSync(rutaCompleta, separatorRow);
    } catch (error) {
        
        console.error('Error al guardar los errores entity:', error);
        dialog.showErrorBox('Error al guardar los errores entity\nVerificar si el archivo de errores se encuentra abierta', error.message);
        
    }

}


/*
function guardarInformacion(numeroOrden, respuesta) {
    const nombreArchivo = path.join(obtenerRutaGuardado(), 'GuardarInvoice.json');
    fs.writeFileSync(nombreArchivo, JSON.stringify(respuesta, null, 2));
    console.log(`Respuesta para el número de orden ${numeroOrden} guardada en ${nombreArchivo}`);
}
*/
function guardarInformacion(numeroOrden, respuesta) {
    const nombreArchivo = 'RespuestasAPIInvoice.csv';
    const rutaGuardado = obtenerRutaGuardado();
    const rutaCompleta = path.join(rutaGuardado, nombreArchivo);
    //const nombreArchivo = path.join(obtenerRutaGuardado(), 'RespuestasAPI.csv');
    const fields = ['Numero de Orden', 'Respuesta'];
    const separatorRow = '\n//////////////////////////////////////////////////\n';
    // Verificar si la carpeta de errores existe
    if (!fs.existsSync(rutaGuardado)) {
        // Si no existe, la creamos
        fs.mkdirSync(rutaGuardado);
        console.log(`Carpeta de errores creada en ${rutaGuardado}`);
    }
    // Convertir la respuesta en una cadena de texto separada por comas
    const respuestaFormateada = respuesta.toString(); // Esto es un ejemplo, podrías ajustarlo según el tipo de respuesta

    // Crear la línea de contenido CSV
    const csvContent = `${numeroOrden},${respuestaFormateada}\n`;
    

    try {
        // Verificar si el archivo ya existe
        if (fs.existsSync(rutaCompleta)) {
            // Si existe, agregar al archivo
            fs.appendFileSync(rutaCompleta, csvContent);
            console.log(`Respuesta para el número de orden ${numeroOrden} agregada a ${rutaCompleta}`);
            fs.appendFileSync(rutaCompleta, separatorRow);
        } else {
            // Si no existe, crear uno nuevo con los encabezados
            fs.writeFileSync(rutaCompleta, `${fields.join(',')}\n${csvContent}`);
            console.log(`Respuesta para el número de orden ${numeroOrden} guardada en ${rutaCompleta}`);
        }
        //fs.appendFileSync(rutaCompleta, separatorRow);
    } catch (error) {
        console.error('Error al guardar la respuesta del API Invoice:', error);
    }
}


function guardarInformacionEntity(numeroOrden, respuesta) {
    const nombreArchivo = 'RespuestasAPIEntity.csv';
    const rutaGuardado = obtenerRutaGuardado();
    const rutaCompleta = path.join(rutaGuardado, nombreArchivo);
    //const nombreArchivo = path.join(obtenerRutaGuardado(), 'RespuestasAPI.csv');
    const fields = ['Numero de Orden', 'Respuesta'];
    const separatorRow = '\n//////////////////////////////////////////////////\n';
    // Verificar si la carpeta de errores existe
    if (!fs.existsSync(rutaGuardado)) {
        // Si no existe, la creamos
        fs.mkdirSync(rutaGuardado);
        console.log(`Carpeta de errores creada en ${rutaGuardado}`);
    }
    // Convertir la respuesta en una cadena de texto separada por comas
    const respuestaFormateada = respuesta.toString(); // Esto es un ejemplo, podrías ajustarlo según el tipo de respuesta

    //const fields = ['Numero de Orden', 'Mensaje de Error'];
    //const csvContent = parse(erroresEntity.map(error => ({ 'Numero de Orden': error.numeroOrden, 'Mensaje de Error': error.mensaje })), { fields });
    // Crear la línea de contenido CSV
    const csvContent = `${numeroOrden},${respuestaFormateada}`;
    

    try {
        // Verificar si el archivo ya existe
        if (fs.existsSync(rutaCompleta)) {
            // Si existe, agregar al archivo
            fs.appendFileSync(rutaCompleta, csvContent);
            console.log(`Respuesta para el número de orden ${numeroOrden} agregada a ${rutaCompleta}`);
           // fs.appendFileSync(rutaCompleta, separatorRow);
        } else {
            // Si no existe, crear uno nuevo con los encabezados
            fs.writeFileSync(rutaCompleta, `${fields.join(',')}\n${csvContent}`);
            console.log(`Respuesta para el número de orden ${numeroOrden} guardada en ${rutaCompleta}`);
        }
        fs.appendFileSync(rutaCompleta, separatorRow);
    } catch (error) {
        console.error('Error al guardar la respuesta del API Entity:', error);
    }
}

/*
function guardarInformacionEntity(numeroOrden, respuesta) {
    const nombreArchivo = path.join(obtenerRutaGuardado(), 'GuardarEntity.json');
    fs.writeFileSync(nombreArchivo, JSON.stringify(respuesta, null, 2));
    console.log(`Respuesta para el número de orden ${numeroOrden} guardada en ${nombreArchivo}`);
}*/


module.exports = { ejecutarAccion };

