<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useChatStore } from "@/features/chat/useChatStore";
import { useRouteSetting } from "@/views/Setting/useRouteSetting";
import { useI18n } from "@/features/i18n/useI18n";
import SidebarOperation from "@/views/Chat/ChatList/SidebarOperation.vue";
import { ArrowLeft, Database, Info, Paintbrush, Server, Plug, Cpu } from "lucide-vue-next";

const router = useRouter();
const store = useChatStore();
const { activeTab, switchTab } = useRouteSetting();
const { t } = useI18n();

const menuOptions = computed(() => [
    {
        label: t("settings.menu.api"),
        key: "api",
        icon: Server,
    },
    {
        label: t("settings.menu.model"),
        key: "model",
        icon: Cpu,
    },
    {
        label: t("settings.menu.mcp"),
        key: "mcp",
        icon: Plug,
    },
    {
        label: t("settings.menu.ui"),
        key: "ui",
        icon: Paintbrush,
    },
    {
        label: t("settings.menu.data"),
        key: "data",
        icon: Database,
    },
    {
        label: t("settings.menu.about"),
        key: "about",
        icon: Info,
    },
]);

const handleBack = async () => {
    const target = store.lastChatRoutePath || "/";
    await router.push(target);
};
</script>

<template>
    <div class="flex flex-col h-full w-[18rem] flex-shrink-0 overflow-hidden bg-bg-200 dark:bg-sidebar dark:border-r dark:border-white/10">
        <div class="flex flex-col h-full w-[18rem] flex-shrink-0 bg-bg-100 lg:bg-gradient-to-t lg:from-bg-200/5 lg:to-bg-200/30 dark:bg-sidebar dark:bg-none text-text-100">
            <div class="min-h-10" />
            <div class="px-2 pb-2">
                <SidebarOperation
                    :icon="ArrowLeft"
                    :text="t('common.back')"
                    @click="handleBack"
                />
            </div>
            <div class="px-2 pb-3">
                <div class="flex flex-col gap-1">
                    <SidebarOperation
                        v-for="item in menuOptions"
                        :key="item.key"
                        :icon="item.icon"
                        :text="item.label"
                        :is-active="activeTab === item.key"
                        @click="switchTab(item.key)"
                    />
                </div>
            </div>
        </div>
    </div>
</template>
