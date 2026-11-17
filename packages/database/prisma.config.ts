import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generate/validate are offline; migration commands still require DIRECT_URL.
  datasource: { url: process.env.DIRECT_URL ?? '' },
});
