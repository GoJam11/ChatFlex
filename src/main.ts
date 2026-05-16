import "./assets/index.less";
import "./assets/base.css";
import "vue-sonner/style.css"; // vue-sonner v2 requires this import
// import { Client } from "appwrite";
import { createApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
import router from "./router";
import { Toaster } from "vue-sonner";
import { i18n } from "./i18n";
import { initLogger, logger } from "./utils/logger";
import { migrateLegacyDatabases } from "./persistence/legacy-migration";
import { migrateImagesToFileSystem } from "./persistence/imageMigration";

await initLogger();
logger.info('ChatFlex starting...');

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(i18n);
app.component('Toaster', Toaster);
// 迁移旧版 Dexie 数据到 ChatFlexDB，再挂载应用，避免首次渲染数据闪烁
await migrateLegacyDatabases();
// 迁移 IndexedDB 中的图片 Blob 到文件系统
await migrateImagesToFileSystem();
app.mount("#app");

// const client = new Client();
// client.setProject("678c8827001b1c559cfc");
