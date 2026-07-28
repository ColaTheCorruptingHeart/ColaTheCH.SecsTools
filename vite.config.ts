import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const packageText = readFileSync(new URL('./package.json', import.meta.url), 'utf8').replace(/^\uFEFF/, '');
const packageJson = JSON.parse(packageText) as { version: string };

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    plugins: [
        plugin(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: false,
            workbox: {
                // Keep hashed static assets cached, but do not precache index.html.
                // A stale entry HTML can point at removed /assets/*.js files after deploy.
                globPatterns: ['**/*.{js,css,ico,png,svg,json,txt,woff2}'],
                cleanupOutdatedCaches: true,
                navigateFallback: undefined,
                navigateFallbackDenylist: [
                    /^\/assets\//,
                    /^\/registerSW\.js$/,
                    /^\/sw\.js$/,
                    /^\/workbox-.*\.js$/,
                ],
            },
            manifest: {
                name: 'SECS Tools',
                short_name: 'SECS Tools',
                description: 'Various SECS tools including Log Timeline Analyzer',
                theme_color: '#ffffff',
                // Add app icons under public/ when needed.
                // icons: [
                //   {
                //     src: '/icon.png',
                //     sizes: '192x192',
                //     type: 'image/png'
                //   }
                // ]
            }
        })
    ],
    server: {
        port: 63897,
    }
})
