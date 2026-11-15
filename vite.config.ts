import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import path from 'path';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ command }) => {
  return {
    plugins: [
      tsConfigPaths({ projects: ['./tsconfig.json'] }),
      tailwindcss(),
      tanstackStart({
        server: { entry: 'server' },
      }),
      ...(command === 'build' ? [nitro({ preset: 'node-server' })] : []),
      viteReact(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env['DISABLE_HMR'] !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env['DISABLE_HMR'] === 'true' ? null : {},
    },
  };
});
