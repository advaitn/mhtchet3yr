import { defineConfig } from '@prisma/internals';

export default defineConfig({
  adapter: {
    type: 'node_postgres',
    url: process.env.DATABASE_URL_2,
  },
});
