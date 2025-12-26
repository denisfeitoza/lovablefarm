import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import apiRoutes from './api/routes.js';
import { queueManager } from './queue/QueueManager.js';
import { domainManager } from './queue/DomainManager.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

const PORT = process.env.WEB_PORT || 3000;
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, ''); // Remove trailing slash

// Configure Socket.IO with base path
const io = new Server(httpServer, {
  path: BASE_PATH ? `${BASE_PATH}/socket.io/` : '/socket.io/'
});

// Middleware
app.use(express.json());

// Root route - inject BASE_PATH into HTML (MUST BE BEFORE static files)
const indexPath = join(__dirname, 'public', 'index.html');
app.get(BASE_PATH || '/', (req, res) => {
  try {
    let html = readFileSync(indexPath, 'utf8');
    // Inject BASE_PATH into HTML (ensure proper format)
    const basePathForHtml = BASE_PATH || '';
    // Replace all instances of {{BASE_PATH}} with the actual base path
    html = html.replace(/\{\{BASE_PATH\}\}/g, basePathForHtml);
    logger.info(`Serving index.html with BASE_PATH: "${basePathForHtml}"`);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Erro ao servir index.html', error);
    res.status(500).send('Erro ao carregar página');
  }
});

// Redirect root to base path if BASE_PATH is set
if (BASE_PATH) {
  app.get('/', (req, res) => {
    res.redirect(BASE_PATH);
  });
}

// Serve static files with base path (EXCLUDE index.html - it's handled above)
if (BASE_PATH) {
  app.use(BASE_PATH, express.static(join(__dirname, 'public'), { index: false }));
}
// Always serve static files from root as well (for backwards compatibility, exclude index.html)
app.use(express.static(join(__dirname, 'public'), { index: false }));

// API Routes
if (BASE_PATH) {
  app.use(`${BASE_PATH}/api`, apiRoutes);
} else {
  app.use('/api', apiRoutes);
}

// WebSocket connection
io.on('connection', (socket) => {
  logger.info(`🔌 Cliente conectado: ${socket.id}`);

  // Enviar estatísticas iniciais
  socket.emit('stats:update', queueManager.getStats());
  socket.emit('domains:update', domainManager.listDomains());
  socket.emit('queues:update', queueManager.listQueues());

  // Listener para eventos do QueueManager
  const eventListener = (event, data) => {
    socket.emit(event, data);
    
    // Atualizar estatísticas em cada evento
    if (event.startsWith('queue:') || event.startsWith('execution:')) {
      socket.emit('stats:update', queueManager.getStats());
      
      if (event.startsWith('queue:')) {
        socket.emit('queues:update', queueManager.listQueues());
      }
      
      if (event.startsWith('execution:')) {
        socket.emit('executions:update', queueManager.listActiveExecutions());
      }
    }
  };

  queueManager.addListener(eventListener);

  socket.on('disconnect', () => {
    logger.info(`🔌 Cliente desconectado: ${socket.id}`);
  });

  // Request manual de atualização
  socket.on('request:stats', () => {
    socket.emit('stats:update', queueManager.getStats());
  });

  socket.on('request:queues', () => {
    socket.emit('queues:update', queueManager.listQueues());
  });

  socket.on('request:executions', () => {
    socket.emit('executions:update', queueManager.listActiveExecutions());
  });

  socket.on('request:domains', () => {
    socket.emit('domains:update', domainManager.listDomains());
  });
});

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🚀 LOVABLE REFERRAL TESTER - INTERFACE WEB');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  🌐 Servidor rodando em: http://localhost:${PORT}`);
  if (BASE_PATH) {
    console.log(`  📊 Dashboard: http://localhost:${PORT}${BASE_PATH}`);
  } else {
    console.log(`  📊 Dashboard: http://localhost:${PORT}`);
  }
  console.log(`  🔌 WebSocket habilitado para monitoramento em tempo real`);
  if (BASE_PATH) {
    console.log(`  📍 BASE_PATH: ${BASE_PATH}`);
  }
  console.log('═══════════════════════════════════════════════════════');
  console.log('\n');
  
  logger.success(`Servidor web iniciado na porta ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Encerrando servidor...');
  httpServer.close(() => {
    logger.info('Servidor encerrado');
    process.exit(0);
  });
});

