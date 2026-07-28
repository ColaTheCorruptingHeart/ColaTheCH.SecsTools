import './assets/main.css'
import 'element-plus/dist/index.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error('Service worker registration failed:', error)
  },
})

const app = createApp(App)

app.use(router)
app.use(ElementPlus)

app.mount('#app')
