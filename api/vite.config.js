import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

const dirname = path.dirname(fileURLToPath(import.meta.url));

function lanHost() {
    for (const addrs of Object.values(os.networkInterfaces())) {
        for (const addr of addrs ?? []) {
            const ipv4 = addr.family === 'IPv4' || addr.family === 4;
            if (!ipv4 || addr.internal || addr.address.startsWith('169.254.')) {
                continue;
            }
            return addr.address;
        }
    }
    return 'localhost';
}

const host = lanHost();

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/editor.tsx', 'resources/js/explore.tsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(dirname, 'resources/js'),
        },
    },
    css: {
        postcss: {
            plugins: [],
        },
    },
    server: {
        host: '0.0.0.0',
        cors: true,
        origin: `http://${host}:5173`,
        hmr: { host },
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
