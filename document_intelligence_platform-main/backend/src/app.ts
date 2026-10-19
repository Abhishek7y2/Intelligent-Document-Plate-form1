import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/env.config.js';
import { apiRouter } from './routes/api.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import { correlationMiddleware } from './middleware/correlation.middleware.js';

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { authenticateJwt } from './middleware/auth.middleware.js';
import { getLiveness, getReadiness, getMetrics } from './controllers/health.controller.js';
import { metricsMiddleware } from './services/metrics.service.js';

export const app = express();

// 0. Correlation ID Middleware (registered FIRST to ensure complete async context propagation)
app.use(correlationMiddleware);

// Configure reverse proxy trust if specified (prevents spoofing while allowing accurate client IP resolution behind load balancers)
if (config.trustProxy) {
  app.set('trust proxy', config.trustProxy);
}

// 1. Security & Performance Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allows Swagger UI assets to render seamlessly
}));
app.use(
  compression({
    threshold: 1024,
    level: 6,
  })
);
app.use(
  cors({
    origin: config.corsAllowedOrigins,
    credentials: true,
  })
);

// 2. Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2.1 Swagger UI Documentation (FR-023 / Part A) - Authenticated in production
const swaggerAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (process.env['NODE_ENV'] === 'production') {
    return authenticateJwt(req as any, res, next);
  }
  next();
};

const openapiPaths = [
  path.resolve(process.cwd(), 'openapi.yaml'),
  path.resolve(process.cwd(), 'backend', 'openapi.yaml'),
  path.resolve(process.cwd(), '..', 'openapi.yaml'),
];
const foundOpenApiPath = openapiPaths.find((p) => fs.existsSync(p));
if (foundOpenApiPath) {
  try {
    const yamlContent = fs.readFileSync(foundOpenApiPath, 'utf8');
    const swaggerDoc = yaml.parse(yamlContent);
    app.use('/api/docs', swaggerAuthMiddleware, swaggerUi.serve, swaggerUi.setup(swaggerDoc));
  } catch {
    // Graceful fallback if YAML is being written
  }
}

// 2.2 Metrics Middleware (Part B.4)
app.use(metricsMiddleware);

// Top-level Health & Metrics Routes for orchestration / scraper compatibility (NFR-01)
app.get('/health/live', getLiveness);
app.get('/health/ready', getReadiness);
app.get('/metrics', getMetrics);

// 3. API Routes Registration
app.use(config.apiPrefix, apiRouter);

// 4. Fallback 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    type: 'https://api.docunexa.enterprise/errors/NOT_FOUND',
    title: `The requested endpoint '${req.originalUrl}' does not exist.`,
    status: 404,
    instance: req.originalUrl,
  });
});

// 5. Global Error Handling Middleware
app.use(errorHandler);
