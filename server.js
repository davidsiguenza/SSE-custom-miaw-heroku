import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS para todos los orígenes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Ruta de verificación de salud
app.get('/', (req, res) => {
  res.status(200).send('Proxy SSE funcionando correctamente');
});

// Ruta para el proxy SSE
app.get('/sse-proxy', async (req, res) => {
  // Extraemos los parámetros de la query string
  const { scrtUrl, conversationId, lastEventId, orgId, accessToken } = req.query;
  
  // Verificamos que se hayan pasado todos los parámetros necesarios
  if (!scrtUrl || !conversationId || !orgId || !accessToken) {
    return res.status(400).send('Faltan parámetros necesarios: scrtUrl, conversationId, orgId y accessToken.');
  }
  
  // Construir la URL del endpoint SSE de Salesforce
  const sseUrl = `https://${scrtUrl}/eventrouter/v1/sse?conversationId=${conversationId.toLowerCase()}&lastEventId=${lastEventId || '0'}`;
  
  console.log(`[${new Date().toISOString()}] Iniciando conexión SSE para conversationId: ${conversationId}`);
  
  try {
    // Realizamos la petición al endpoint SSE, agregando el header X-Org-Id
    const response = await fetch(sseUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${accessToken}`,
        'X-Org-Id': orgId
      }
    });
    
    if (!response.ok) {
      const errMsg = await response.text();
      console.error(`[${new Date().toISOString()}] Error en la respuesta del servidor SSE: ${response.status} ${errMsg}`);
      return res.status(response.status).send(`Error del servidor SSE: ${response.status} - ${errMsg}`);
    }
    
    // IMPORTANTE: Configuramos los headers de la respuesta para SSE
    // Esto garantiza que el cliente reciba el tipo MIME correcto
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });
    
    console.log(`[${new Date().toISOString()}] Conexión SSE establecida para conversationId: ${conversationId}`);
    
    // Enviar evento inicial para confirmar la conexión
    res.write('event: connected\ndata: {"status":"connected"}\n\n');
    
    // Configuramos un ping cada 30 segundos para mantener la conexión viva
    const pingInterval = setInterval(() => {
      if (!res.writableEnded) {
        console.log(`[${new Date().toISOString()}] Enviando ping para mantener conexión viva`);
        res.write('event: ping\ndata: {"time":"' + new Date().toISOString() + '"}\n\n');
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
    
    // Manejamos el stream de eventos desde Salesforce y lo reenviamos al cliente
    response.body.on('data', (chunk) => {
      if (!res.writableEnded) {
        const chunkStr = chunk.toString();
        console.log(`[${new Date().toISOString()}] Recibido chunk de datos: ${chunkStr.substring(0, 50)}...`);
        res.write(chunk);
      }
    });
    
    response.body.on('end', () => {
      console.log(`[${new Date().toISOString()}] Conexión SSE finalizada por el servidor para conversationId: ${conversationId}`);
      clearInterval(pingInterval);
      
      if (!res.writableEnded) {
        res.write('event: closed\ndata: {"status":"closed_by_server"}\n\n');
        res.end();
      }
    });
    
    response.body.on('error', (err) => {
      console.error(`[${new Date().toISOString()}] Error en el stream SSE: ${err.message}`);
      clearInterval(pingInterval);
      
      if (!res.writableEnded) {
        res.write(`event: error\ndata: {"error":"${err.message}"}\n\n`);
        res.end();
      }
    });
    
    // Si la conexión se cierra desde el cliente, limpiamos recursos
    req.on('close', () => {
      console.log(`[${new Date().toISOString()}] Cliente cerró la conexión SSE para conversationId: ${conversationId}`);
      clearInterval(pingInterval);
      response.body.destroy();
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en el proxy SSE:`, error);
    res.status(500).send(`Error en el proxy SSE: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Proxy SSE escuchando en el puerto ${PORT}`);
});
