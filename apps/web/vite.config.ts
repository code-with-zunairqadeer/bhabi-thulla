import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Use the engine's TypeScript source directly; no build step needed.
      '@bhabi-thulla/game-engine': path.resolve(__dirname, '../../packages/game-engine/src/index.ts'),
    },
  },
});
