<template>
    <div class="flex flex-col gap-6">
        <!-- 页头 -->
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-lg font-semibold text-text-100">{{ t('dataExport.title') }}</h2>
                <p class="text-sm text-text-300 mt-1">
                    {{ t('dataExport.description') }}
                </p>
            </div>
        </div>

        <!-- 数据导出 -->
        <div>
            <p class="section-title">
                {{ t('dataExport.title') }}
            </p>
            <Card>
                <CardContent class="space-y-4">
                    <!-- 模型配置导出 -->
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="setting-label">{{ t('dataExport.modelConfig') }}</span>
                            <p class="setting-description">
                                {{ t('dataExport.modelConfigDesc') }}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            :disabled="isExporting.modelConfig"
                            @click="exportModelConfig"
                        >
                            {{ isExporting.modelConfig ? t('dataExport.exporting') : t('dataExport.export') }}
                        </Button>
                    </div>

                    <!-- 会话历史记录导出 -->
                    <div class="flex items-center justify-between gap-4">
                        <div>
                            <span class="setting-label">{{ t('dataExport.chatHistory') }}</span>
                            <p class="setting-description">
                                {{ t('dataExport.chatHistoryDesc') }}
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        class="flex items-center gap-1"
                                    >
                                        {{ chatHistoryFormatLabel }}
                                        <ChevronDown class="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        :disabled="chatHistoryExportFormat === 'json'"
                                        @click="chatHistoryExportFormat = 'json'"
                                    >
                                        {{ t('dataExport.formatJson') }}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        :disabled="chatHistoryExportFormat === 'markdown'"
                                        @click="chatHistoryExportFormat = 'markdown'"
                                    >
                                        {{ t('dataExport.formatMarkdown') }}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                                size="sm"
                                :disabled="isExporting.chatHistory"
                                @click="exportChatHistory"
                            >
                                {{ isExporting.chatHistory ? t('dataExport.exporting') : t('dataExport.export') }}
                            </Button>
                        </div>
                    </div>

                    <!-- 搜索索引说明 -->
                    <div>
                        <span class="setting-label">{{ t('dataExport.searchIndex') }}</span>
                        <p class="setting-description">
                            {{ t('dataExport.searchIndexDesc') }}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Alert>
            <AlertTriangle class="h-4 w-4" />
            <AlertTitle>{{ t('dataExport.warning') }}</AlertTitle>
            <AlertDescription>
                {{ t('dataExport.warningDesc') }}
            </AlertDescription>
        </Alert>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { AlertTriangle, ChevronDown } from "lucide-vue-next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDataExport } from "@/features/export/useDataExport";

const {
    chatHistoryExportFormat,
    chatHistoryFormatLabel,
    exportChatHistory,
    exportModelConfig,
    isExporting,
} = useDataExport();
const { t } = useI18n();
</script>

<style scoped>
/* 设置标签 */
.setting-label {
    display: block;
    color: var(--color-text);
    font-size: 0.875rem;
}

/* 描述文字 */
.setting-description {
    font-size: 0.75rem;
    color: var(--text-secondary-color);
    line-height: 1.5;
}

/* 标题样式 */
.section-title {
    font-weight: bold;
    color: var(--color-text);
    margin-bottom: 0.5rem;
}
</style>
