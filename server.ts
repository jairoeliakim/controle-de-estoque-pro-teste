import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './src/server/app.js';

async function startServer() {
  const app = createApiApp();
  const PORT = 3000;

  // Vite Middleware (Desenvolvimento) vs Arquivos Estáticos (Produção)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] SaaS Backend rodando em http://localhost:${PORT}`);
  });
}

startServer();
