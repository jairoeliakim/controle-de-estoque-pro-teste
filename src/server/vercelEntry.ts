import { createApiApp } from './app.js';

// Função serverless da Vercel: exporta o app Express como handler.
// O esbuild empacota este arquivo em api/index.js (ver script "build:api").
export default createApiApp();
