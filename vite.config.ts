import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        plugin(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                // 用于缓存所有常见的静态资源
                globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}']
            },
            manifest: {
                name: 'SECS Tools',
                short_name: 'SECS Tools',
                description: 'Various SECS tools including Log Timeline Analyzer',
                theme_color: '#ffffff',
                // 可以放一个应用图标，需在 public 下提供 icon
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
