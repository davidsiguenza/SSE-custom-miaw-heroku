Salesforce SSE Proxy
Un proxy simple para manejar eventos Server-Sent Events (SSE) de Salesforce.
Descripción
Este servicio actúa como un proxy para la funcionalidad de Server-Sent Events de Salesforce, permitiendo conexiones en tiempo real entre el cliente y el servidor.
Características

Manejo de conexiones SSE
Soporte para CORS
Funcionalidad de heartbeat para mantener conexiones vivas
Gestión de reconexiones

Uso
javascriptCopy// En el cliente (agentChat.js)
const proxyUrl = 'https://tu-app-heroku.herokuapp.com/sse-proxy';
const sseUrl = `${proxyUrl}?scrtUrl=${encodeURIComponent(this.scrtUrl)}&conversationId=${encodeURIComponent(this.sessionId)}&lastEventId=${this.sseLastEventId}&orgId=${this.orgId}&accessToken=${this.token}`;

this.eventSource = new EventSource(sseUrl);
Despliegue
Esta aplicación está configurada para desplegarse en Heroku.
