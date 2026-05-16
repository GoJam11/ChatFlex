<template>
    <div class="w-full h-full flex flex-col">
        <div class="setting-content">
            <!-- API设置 -->
            <div v-if="activeTab === 'api'" class="content-section !p-0">
                <ApiSettingForm />
            </div>

            <!-- 模型设置 -->
            <div v-if="activeTab === 'model'" class="content-section">
                <ModelSettingComponent />
            </div>

            <!-- MCP设置 -->
            <div v-if="activeTab === 'mcp'" class="content-section">
                <McpSettingComponent />
            </div>

            <!-- 界面设置 -->
            <div v-if="activeTab === 'ui'" class="content-section">
                <UiSettingComponent />
            </div>

            <!-- 数据导出 -->
            <div v-if="activeTab === 'data'" class="content-section">
                <DataExportComponent />
            </div>

            <!-- 关于 -->
            <div v-if="activeTab === 'about'" class="content-section">
                <AboutComponent />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import ApiSettingForm from "@/views/Setting/ApiSetting/ApiSettingForm.vue";
import DataExportComponent from "@/views/Setting/DataExport/DataExportComponent.vue";
import UiSettingComponent from "@/views/Setting/UiSetting/UiSettingComponent.vue";
import AboutComponent from "@/views/Setting/About/AboutComponent.vue";
import McpSettingComponent from "@/views/Setting/McpSetting/McpSettingComponent.vue";
import ModelSettingComponent from "@/views/Setting/ModelSetting/ModelSettingComponent.vue";
import { useRouteSetting } from "@/views/Setting/useRouteSetting.ts";

const { activeTab } = useRouteSetting();
</script>

<style scoped>
/* 内容区域 */
.setting-content {
    flex: 1;
    overflow: auto;
    background-color: var(--bg-100);
}

.content-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem 1.5rem 1.5rem 1.5rem;
    height: 100%;
    overflow: auto;
}

.setting-description p {
    margin-bottom: 0.75rem;
}

.setting-description strong {
    color: var(--color-text);
    font-weight: 600;
}

</style>
