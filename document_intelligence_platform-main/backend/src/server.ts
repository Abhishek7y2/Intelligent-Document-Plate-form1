import { app } from './app.js';
import { config, validateEnvironment } from './config/env.config.js';
import { dbPool, validateDatabaseConnection } from './database/postgres.client.js';
import { initializeDatabasePersistence } from './database/persistence-initializer.js';
import { OutboxService } from './services/outbox.service.js';

async function bootstrap() {
  validateEnvironment();

  // Validate PostgreSQL connectivity on startup
  const dbStatus = await validateDatabaseConnection();
  if (dbStatus.connected) {
    console.log(`[DOCUNEXA BACKEND] PostgreSQL connection established successfully.`);
    console.log(`[DOCUNEXA BACKEND] Database: ${dbStatus.database} | User: ${dbStatus.user} | Host: ${config.postgres.host}:${config.postgres.port}`);
    console.log(`[DOCUNEXA BACKEND] Engine: ${dbStatus.version}`);

    // Enable durable database persistence across supported domain services
    initializeDatabasePersistence('database');
    console.log(`[DOCUNEXA BACKEND] Durable database persistence mode enabled across 15 domain services.`);
  } else {
    console.warn(`[DOCUNEXA BACKEND] Warning: PostgreSQL startup connection validation failed: ${dbStatus.error}`);
    console.warn(`[DOCUNEXA BACKEND] Target was: ${config.postgres.user}@${config.postgres.host}:${config.postgres.port}/${config.postgres.database}`);
    console.warn(`[DOCUNEXA BACKEND] Operating in fallback in-memory mode.`);
  }

  // Initialize reliable background Outbox Worker for asynchronous publication and indexing
  OutboxService.startWorker(config.env === 'production' ? 5000 : 10000);

  const server = app.listen(config.port, () => {
    console.log(`[DOCUNEXA BACKEND] Server running in '${config.env}' mode on port ${config.port}`);
    console.log(`[DOCUNEXA BACKEND] Base API Endpoint: http://localhost:${config.port}${config.apiPrefix}`);
  });

  // Graceful Shutdown Listener
  const shutdown = (signal: string) => {
    console.log(`[DOCUNEXA BACKEND] ${signal} signal received. Closing Outbox worker, HTTP server, and PostgreSQL pool...`);
    OutboxService.stopWorker();
    server.close(async () => {
      try {
        await dbPool.end();
        console.log('[DOCUNEXA BACKEND] PostgreSQL connection pool closed safely.');
        process.exit(0);
      } catch (err: any) {
        console.error('[DOCUNEXA BACKEND] Error during database shutdown:', err.message);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[DOCUNEXA BACKEND] Fatal bootstrap error:', err);
  process.exit(1);
});
