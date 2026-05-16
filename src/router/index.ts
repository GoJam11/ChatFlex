import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import ChatPage from '@/views/Chat/ChatPage.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Layout',
    component: ChatPage,
  },
  {
    path: '/chat/:uuid',
    name: 'Chat',
    component: ChatPage,
  },
  {
    path: '/prompts',
    name: 'Prompts',
    component: ChatPage,
  },
  {
    path: '/memory',
    name: 'Memory',
    component: ChatPage,
  },
  {
    path: '/setting',
    redirect: '/setting/api',
  },
  {
    path: '/setting/:tab',
    name: 'Setting',
    component: ChatPage,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
