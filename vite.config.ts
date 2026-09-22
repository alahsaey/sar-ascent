import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-verify-endpoint',
        configureServer(server: any) {
          server.middlewares.use('/api/verify', (req: any, res: any, next: any) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', (chunk: any) => { body += chunk; });
              req.on('end', () => {
                try {
                  const parsed = JSON.parse(body || '{}');
                  const empNum = String(parsed.employee_number || '').trim();
                  const sampleAuthorized = ['001234', '005678', '104820', '209341', '000492', '340219', '008952', '551902', '004312', '789201'];
                  const isAuthorized = sampleAuthorized.includes(empNum);

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    authorized: isAuthorized,
                    message: isAuthorized ? 'مصرح له بالسفر' : 'غير مصرح له بالسفر',
                    last_updated: '2026-09-17T07:30:00'
                  }));
                } catch {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
              });
            } else {
              next();
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
