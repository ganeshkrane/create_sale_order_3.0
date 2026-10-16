import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import {fileURLToPath} from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'ui5-static-assets-mime',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url || '';
            if (url.includes('.properties')) {
              res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            } else if (url.includes('/webapp/css/style.css') && !url.includes('?import')) {
              const filePath = path.resolve(__dirname, 'webapp/css/style.css');
              if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', 'text/css; charset=utf-8');
                return res.end(fs.readFileSync(filePath, 'utf-8'));
              }
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
