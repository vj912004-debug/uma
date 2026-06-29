import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'uma-dev-secret-change-me',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  dbSsl: process.env.DATABASE_SSL === 'true'
};

if (!config.databaseUrl) {
  console.warn('DATABASE_URL is not set. Copy server/.env.example to server/.env');
}
