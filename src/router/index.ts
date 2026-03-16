import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import Layout from '../layout/mainLayout.vue'
import { flatTools } from '../config/tools'

// Map tool routes from configurations
// Note: Vite dynamic imports need to be resolvable statically.
// Standard glob pattern works: `../views/tools/${name}.vue`
const toolRoutes: Array<RouteRecordRaw> = flatTools.map(tool => ({
  path: tool.path.replace('/tools/', ''),
  name: tool.id,
  component: () => import(`../views/tools/${tool.componentPath}.vue`),
  meta: { title: tool.name }
}));

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    component: Layout,
    redirect: '/home',
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('../views/HomePage.vue'),
        meta: { title: '主页' }
      },
      {
        path: 'tools',
        name: 'Tools',
        redirect: toolRoutes.length > 0 && toolRoutes[0]?.path ? `/tools/${String(toolRoutes[0].path)}` : '/home',
        children: toolRoutes
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
