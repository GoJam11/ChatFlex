<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { Plus, Trash2, Edit2, RefreshCw, Check, X, Plug, PlugZap, ChevronDown, ChevronRight, Wrench, Sparkles, ExternalLink } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { mcpDb } from "@/persistence/McpDatabase";
import { mcpClientService } from "@/features/mcp/mcpClientService";
import type { McpServerConfig, McpServerState, McpToolDefinition } from "@/types/mcp";
import { useI18n } from "@/features/i18n/useI18n";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const { t } = useI18n();

const servers = ref<McpServerConfig[]>([]);
const serverStates = ref<Map<string, McpServerState>>(new Map());
const isLoading = ref(false);
const isAddDialogOpen = ref(false);
const isEditDialogOpen = ref(false);
const editingServer = ref<McpServerConfig | null>(null);
const expandedServers = ref<Set<string>>(new Set());
const selectedTool = ref<McpToolDefinition | null>(null);
const isToolDetailOpen = ref(false);

// 表单状态
const formName = ref("");
const formUrl = ref("");
const formDescription = ref("");
const formHeaders = ref("");
const formEnabled = ref(true);

const loadServers = async () => {
    isLoading.value = true;
    try {
        servers.value = await mcpDb.getAllServers();
        // 更新服务器状态
        for (const server of servers.value) {
            const state = mcpClientService.getServerState(server.id);
            if (state) {
                serverStates.value.set(server.id, state);
            }
        }
    } catch (error) {
        console.error("[McpSettingComponent] 加载服务器列表失败:", error);
        toast.error("加载 MCP 服务器列表失败");
    } finally {
        isLoading.value = false;
    }
};

const resetForm = () => {
    formName.value = "";
    formUrl.value = "";
    formDescription.value = "";
    formHeaders.value = "";
    formEnabled.value = true;
};

const openAddDialog = () => {
    resetForm();
    isAddDialogOpen.value = true;
};

const openEditDialog = (server: McpServerConfig) => {
    editingServer.value = server;
    formName.value = server.name;
    formUrl.value = server.url;
    formDescription.value = server.description || "";
    formHeaders.value = server.headers ? JSON.stringify(server.headers, null, 2) : "";
    formEnabled.value = server.enabled;
    isEditDialogOpen.value = true;
};

const parseHeaders = (headersStr: string): Record<string, string> => {
    if (!headersStr.trim()) {
        return {};
    }
    try {
        return JSON.parse(headersStr);
    } catch {
        throw new Error("请输入有效的 JSON 格式");
    }
};

const handleAddServer = async () => {
    if (!formName.value.trim() || !formUrl.value.trim()) {
        toast.error("请填写服务器名称和 URL");
        return;
    }

    try {
        const headers = parseHeaders(formHeaders.value);
        const newServer = await mcpDb.addServer({
            name: formName.value.trim(),
            url: formUrl.value.trim(),
            description: formDescription.value.trim() || undefined,
            headers,
            enabled: formEnabled.value,
        });

        servers.value.push(newServer);
        isAddDialogOpen.value = false;
        resetForm();

        if (newServer.enabled) {
            await mcpClientService.connectServer(newServer);
            const state = mcpClientService.getServerState(newServer.id);
            if (state) {
                serverStates.value.set(newServer.id, state);
            }
        }

        toast.success("MCP 服务器添加成功");
    } catch (error) {
        const message = error instanceof Error ? error.message : "添加失败";
        toast.error(message);
    }
};

const handleUpdateServer = async () => {
    if (!editingServer.value) return;

    if (!formName.value.trim() || !formUrl.value.trim()) {
        toast.error("请填写服务器名称和 URL");
        return;
    }

    try {
        const headers = parseHeaders(formHeaders.value);
        await mcpDb.updateServer(editingServer.value.id, {
            name: formName.value.trim(),
            url: formUrl.value.trim(),
            description: formDescription.value.trim() || undefined,
            headers,
            enabled: formEnabled.value,
        });

        // 刷新列表
        await loadServers();

        // 如果启用状态改变，处理连接
        if (formEnabled.value !== editingServer.value.enabled) {
            if (formEnabled.value) {
                const config = await mcpDb.getServerById(editingServer.value.id);
                if (config) {
                    await mcpClientService.connectServer(config);
                }
            } else {
                await mcpClientService.disconnectServer(editingServer.value.id);
            }
        } else if (formEnabled.value) {
            // URL 或 headers 可能改变，重新连接
            await mcpClientService.reconnectServer(editingServer.value.id);
        }

        isEditDialogOpen.value = false;
        editingServer.value = null;
        resetForm();

        toast.success("MCP 服务器更新成功");
    } catch (error) {
        const message = error instanceof Error ? error.message : "更新失败";
        toast.error(message);
    }
};

const handleDeleteServer = async (server: McpServerConfig) => {
    try {
        await mcpClientService.disconnectServer(server.id);
        await mcpDb.deleteServer(server.id);
        servers.value = servers.value.filter((s) => s.id !== server.id);
        serverStates.value.delete(server.id);
        toast.success("MCP 服务器已删除");
    } catch (error) {
        console.error("[McpSettingComponent] 删除服务器失败:", error);
        toast.error("删除失败");
    }
};

const handleToggleEnabled = async (server: McpServerConfig, newEnabled: boolean) => {
    try {
        await mcpDb.setServerEnabled(server.id, newEnabled);
        server.enabled = newEnabled;

        if (newEnabled) {
            await mcpClientService.connectServer(server);
        } else {
            await mcpClientService.disconnectServer(server.id);
        }

        const state = mcpClientService.getServerState(server.id);
        if (state) {
            serverStates.value.set(server.id, state);
        }
    } catch (error) {
        console.error("[McpSettingComponent] 切换服务器状态失败:", error);
        toast.error("切换状态失败");
    }
};

const handleReconnect = async (server: McpServerConfig) => {
    try {
        const success = await mcpClientService.reconnectServer(server.id);
        const state = mcpClientService.getServerState(server.id);
        if (state) {
            serverStates.value.set(server.id, state);
        }

        if (success) {
            toast.success("重新连接成功");
        } else {
            toast.error("重新连接失败");
        }
    } catch (error) {
        console.error("[McpSettingComponent] 重新连接失败:", error);
        toast.error("重新连接失败");
    }
};

const getStatusText = (serverId: string, serverEnabled: boolean): string => {
    if (!serverEnabled) return "已禁用";
    const state = serverStates.value.get(serverId);
    if (!state) return "未连接";
    switch (state.status) {
        case "connected":
            return `已连接 (${state.tools.length} 工具)`;
        case "connecting":
            return "连接中...";
        case "error":
            return `错误: ${state.error || "未知错误"}`;
        default:
            return "未连接";
    }
};

const getStatusColor = (serverId: string, serverEnabled: boolean): string => {
    if (!serverEnabled) return "text-text-400";
    const state = serverStates.value.get(serverId);
    if (!state) return "text-text-400";
    switch (state.status) {
        case "connected":
            return "text-green-500";
        case "connecting":
            return "text-yellow-500";
        case "error":
            return "text-red-500";
        default:
            return "text-text-400";
    }
};

const getServerTools = (serverId: string): McpToolDefinition[] => {
    const state = serverStates.value.get(serverId);
    return state?.tools || [];
};

const toggleServerExpand = (serverId: string) => {
    if (expandedServers.value.has(serverId)) {
        expandedServers.value.delete(serverId);
    } else {
        expandedServers.value.add(serverId);
    }
};

const isServerExpanded = (serverId: string): boolean => {
    return expandedServers.value.has(serverId);
};

const openToolDetail = (tool: McpToolDefinition) => {
    selectedTool.value = tool;
    isToolDetailOpen.value = true;
};

const formatInputSchema = (schema: unknown): string => {
    if (!schema) return "无参数";
    try {
        return JSON.stringify(schema, null, 2);
    } catch {
        return String(schema);
    }
};

// 推荐的 MCP 服务器
interface RecommendedServer {
    name: string;
    description: string;
    urlTemplate: string;
    requiresApiKey: boolean;
    apiKeyPlaceholder?: string;
    learnMoreUrl?: string;
}

const recommendedServers: RecommendedServer[] = [
    {
        name: "Tavily Search",
        description: "强大的 AI 搜索引擎，为 AI 助手提供实时网络搜索能力",
        urlTemplate: "https://mcp.tavily.com/mcp/?tavilyApiKey=",
        requiresApiKey: true,
        apiKeyPlaceholder: "tvly-xxxxxxxx",
        learnMoreUrl: "https://tavily.com/",
    },
];

const isAddRecommendedDialogOpen = ref(false);
const selectedRecommended = ref<RecommendedServer | null>(null);
const recommendedApiKey = ref("");

const openAddRecommendedDialog = (server: RecommendedServer) => {
    selectedRecommended.value = server;
    recommendedApiKey.value = "";
    isAddRecommendedDialogOpen.value = true;
};

const handleAddRecommendedServer = async () => {
    if (!selectedRecommended.value) return;

    const server = selectedRecommended.value;
    
    if (server.requiresApiKey && !recommendedApiKey.value.trim()) {
        toast.error("请输入 API Key");
        return;
    }

    try {
        const url = server.requiresApiKey
            ? `${server.urlTemplate}${recommendedApiKey.value.trim()}`
            : server.urlTemplate;

        const newServer = await mcpDb.addServer({
            name: server.name,
            url,
            description: server.description,
            headers: {},
            enabled: true,
        });

        servers.value.push(newServer);
        isAddRecommendedDialogOpen.value = false;
        selectedRecommended.value = null;
        recommendedApiKey.value = "";

        await mcpClientService.connectServer(newServer);
        const state = mcpClientService.getServerState(newServer.id);
        if (state) {
            serverStates.value.set(newServer.id, state);
        }

        toast.success(`${server.name} 添加成功`);
    } catch (error) {
        const message = error instanceof Error ? error.message : "添加失败";
        toast.error(message);
    }
};

const isRecommendedServerAdded = (server: RecommendedServer): boolean => {
    return servers.value.some((s) => s.url.startsWith(server.urlTemplate));
};

onMounted(async () => {
    await mcpClientService.initialize();
    await loadServers();
});
</script>

<template>
    <div class="flex flex-col gap-6">
        <!-- 标题和添加按钮 -->
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-lg font-semibold text-text-100">MCP 服务器</h2>
                <p class="text-sm text-text-300 mt-1">
                    配置 HTTP Streamable MCP 服务器，在会话中使用其提供的工具
                </p>
            </div>
            <Button @click="openAddDialog">
                <Plus :size="16" />
                <span>添加服务器</span>
            </Button>
        </div>

        <!-- 服务器列表 -->
        <div class="flex flex-col gap-3">
            <div
                v-if="isLoading"
                class="text-center py-8 text-text-300"
            >
                加载中...
            </div>

            <div
                v-else-if="servers.length === 0"
                class="text-center py-8 text-text-300"
            >
                暂无 MCP 服务器，点击上方按钮添加
            </div>

            <Card
                v-for="server in servers"
                :key="server.id"
                class="!py-0 !gap-0 overflow-hidden"
            >
                <!-- 服务器信息行 -->
                <div class="flex items-center justify-between p-4">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <!-- 展开按钮 -->
                        <button
                            v-if="getServerTools(server.id).length > 0"
                            class="p-1 text-text-300 hover:text-text-100 rounded transition-colors"
                            @click="toggleServerExpand(server.id)"
                        >
                            <component
                                :is="isServerExpanded(server.id) ? ChevronDown : ChevronRight"
                                :size="16"
                            />
                        </button>
                        <div v-else class="w-6" />

                        <div
                            class="w-10 h-10 rounded-lg bg-bg-200 flex items-center justify-center flex-shrink-0"
                        >
                            <component
                                :is="server.enabled ? PlugZap : Plug"
                                :size="20"
                                :class="server.enabled ? 'text-accent' : 'text-text-400'"
                            />
                        </div>
                        <div class="min-w-0">
                            <div class="font-medium text-text-100">{{ server.name }}</div>
                            <div class="text-sm text-text-300 truncate max-w-[300px]">
                                {{ server.url }}
                            </div>
                            <div
                                class="text-xs mt-1"
                                :class="getStatusColor(server.id, server.enabled)"
                            >
                                {{ getStatusText(server.id, server.enabled) }}
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <Switch
                            :model-value="server.enabled"
                            @update:model-value="(val: boolean) => handleToggleEnabled(server, val)"
                        />
                        <button
                            v-if="server.enabled"
                            class="p-2 text-text-300 hover:text-text-100 hover:bg-bg-200 rounded-lg transition-colors"
                            title="重新连接"
                            @click="handleReconnect(server)"
                        >
                            <RefreshCw :size="16" />
                        </button>
                        <button
                            class="p-2 text-text-300 hover:text-text-100 hover:bg-bg-200 rounded-lg transition-colors"
                            title="编辑"
                            @click="openEditDialog(server)"
                        >
                            <Edit2 :size="16" />
                        </button>
                        <button
                            class="p-2 text-text-300 hover:text-red-500 hover:bg-bg-200 rounded-lg transition-colors"
                            title="删除"
                            @click="handleDeleteServer(server)"
                        >
                            <Trash2 :size="16" />
                        </button>
                    </div>
                </div>

                <!-- 工具列表（可展开） -->
                <div
                    v-if="isServerExpanded(server.id) && getServerTools(server.id).length > 0"
                    class="border-t border-border-200 bg-bg-50 px-4 py-3"
                >
                    <div class="text-xs font-medium text-text-300 mb-2">可用工具</div>
                    <div class="flex flex-wrap gap-2">
                        <button
                            v-for="tool in getServerTools(server.id)"
                            :key="tool.name"
                            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-200 hover:bg-bg-300 rounded-lg text-sm text-text-200 hover:text-text-100 transition-colors cursor-pointer"
                            @click="openToolDetail(tool)"
                        >
                            <Wrench :size="12" class="text-text-400" />
                            <span>{{ tool.name }}</span>
                        </button>
                    </div>
                </div>
            </Card>
        </div>

        <!-- 推荐的 MCP 服务器 -->
        <div>
            <p class="section-title">推荐服务器</p>
            <div class="flex flex-col gap-3">
                <Card
                    v-for="server in recommendedServers"
                    :key="server.name"
                    class="!py-0 !gap-0"
                >
                    <div class="flex items-center justify-between p-4">
                        <div class="flex items-center gap-3 min-w-0">
                            <div
                                class="w-9 h-9 rounded-lg bg-bg-200 flex items-center justify-center flex-shrink-0"
                            >
                                <Sparkles :size="16" class="text-text-400" />
                            </div>
                            <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-medium text-text-200">{{ server.name }}</span>
                                    <a
                                        v-if="server.learnMoreUrl"
                                        :href="server.learnMoreUrl"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="text-text-400 hover:text-accent transition-colors"
                                        title="了解更多"
                                    >
                                        <ExternalLink :size="12" />
                                    </a>
                                </div>
                                <div class="text-xs text-text-400">{{ server.description }}</div>
                            </div>
                        </div>
                        <Button
                            v-if="!isRecommendedServerAdded(server)"
                            variant="ghost"
                            size="sm"
                            class="text-text-300 hover:text-text-100"
                            @click="openAddRecommendedDialog(server)"
                        >
                            <Plus :size="14" />
                            <span>添加</span>
                        </Button>
                        <span
                            v-else
                            class="text-xs text-text-400 flex items-center gap-1"
                        >
                            <Check :size="12" />
                            已添加
                        </span>
                    </div>
                </Card>
            </div>
        </div>

        <!-- 添加服务器对话框 -->
        <Dialog v-model:open="isAddDialogOpen">
            <DialogContent class="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>添加 MCP 服务器</DialogTitle>
                    <DialogDescription>
                        配置 HTTP Streamable MCP 服务器连接
                    </DialogDescription>
                </DialogHeader>

                <div class="flex flex-col gap-4 py-4">
                    <div class="flex flex-col gap-2">
                        <label for="name" class="text-sm font-medium">名称 *</label>
                        <Input
                            id="name"
                            v-model="formName"
                            placeholder="例如: 搜索服务"
                        />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="url" class="text-sm font-medium">URL *</label>
                        <Input
                            id="url"
                            v-model="formUrl"
                            placeholder="例如: http://localhost:3000/mcp"
                        />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="description" class="text-sm font-medium">描述</label>
                        <Input
                            id="description"
                            v-model="formDescription"
                            placeholder="可选的服务器描述"
                        />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="headers" class="text-sm font-medium">请求头 (JSON)</label>
                        <textarea
                            id="headers"
                            v-model="formHeaders"
                            class="w-full px-3 py-2 bg-bg-200 border border-border-200 rounded-lg text-sm font-mono resize-none"
                            rows="3"
                            placeholder='{"Authorization": "Bearer xxx"}'
                        />
                    </div>

                    <div class="flex items-center gap-2">
                        <Switch v-model="formEnabled" />
                        <label class="text-sm font-medium">立即启用</label>
                    </div>
                </div>

                <DialogFooter>
                    <button
                        class="px-4 py-2 text-text-200 hover:bg-bg-200 rounded-lg transition-colors"
                        @click="isAddDialogOpen = false"
                    >
                        取消
                    </button>
                    <button
                        class="px-4 py-2 bg-text-100 text-bg-100 rounded-lg hover:opacity-90 transition-colors"
                        @click="handleAddServer"
                    >
                        添加
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- 编辑服务器对话框 -->
        <Dialog v-model:open="isEditDialogOpen">
            <DialogContent class="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>编辑 MCP 服务器</DialogTitle>
                    <DialogDescription>
                        修改 MCP 服务器配置
                    </DialogDescription>
                </DialogHeader>

                <div class="flex flex-col gap-4 py-4">
                    <div class="flex flex-col gap-2">
                        <label for="edit-name" class="text-sm font-medium">名称 *</label>
                        <Input
                            id="edit-name"
                            v-model="formName"
                            placeholder="例如: 搜索服务"
                        />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="edit-url" class="text-sm font-medium">URL *</label>
                        <Input
                            id="edit-url"
                            v-model="formUrl"
                            placeholder="例如: http://localhost:3000/mcp"
                        />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="edit-description" class="text-sm font-medium">描述</label>
                        <Input
                            id="edit-description"
                            v-model="formDescription"
                            placeholder="可选的服务器描述"
                        />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="edit-headers" class="text-sm font-medium">请求头 (JSON)</label>
                        <textarea
                            id="edit-headers"
                            v-model="formHeaders"
                            class="w-full px-3 py-2 bg-bg-200 border border-border-200 rounded-lg text-sm font-mono resize-none"
                            rows="3"
                            placeholder='{"Authorization": "Bearer xxx"}'
                        />
                    </div>

                    <div class="flex items-center gap-2">
                        <Switch v-model="formEnabled" />
                        <label class="text-sm font-medium">启用服务器</label>
                    </div>
                </div>

                <DialogFooter>
                    <button
                        class="px-4 py-2 text-text-200 hover:bg-bg-200 rounded-lg transition-colors"
                        @click="isEditDialogOpen = false"
                    >
                        取消
                    </button>
                    <button
                        class="px-4 py-2 bg-text-100 text-bg-100 rounded-lg hover:opacity-90 transition-colors"
                        @click="handleUpdateServer"
                    >
                        保存
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- 工具详情对话框 -->
        <Dialog v-model:open="isToolDetailOpen">
            <DialogContent class="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle class="flex items-center gap-2">
                        <Wrench :size="18" class="text-accent" />
                        {{ selectedTool?.name }}
                    </DialogTitle>
                    <DialogDescription v-if="selectedTool?.description">
                        {{ selectedTool.description }}
                    </DialogDescription>
                </DialogHeader>

                <div class="py-4 overflow-hidden">
                    <div class="text-sm font-medium text-text-200 mb-2">参数结构 (JSON Schema)</div>
                    <div class="overflow-auto max-h-[300px] rounded-lg border border-border-200">
                        <pre class="p-3 bg-bg-200 text-xs font-mono text-text-200 whitespace-pre min-w-max">{{ formatInputSchema(selectedTool?.inputSchema) }}</pre>
                    </div>
                </div>

                <DialogFooter>
                    <button
                        class="px-4 py-2 bg-bg-200 text-text-200 hover:bg-bg-300 rounded-lg transition-colors"
                        @click="isToolDetailOpen = false"
                    >
                        关闭
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- 添加推荐服务器对话框 -->
        <Dialog v-model:open="isAddRecommendedDialogOpen">
            <DialogContent class="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle class="flex items-center gap-2">
                        <Sparkles :size="18" class="text-accent" />
                        添加 {{ selectedRecommended?.name }}
                    </DialogTitle>
                    <DialogDescription v-if="selectedRecommended?.description">
                        {{ selectedRecommended.description }}
                    </DialogDescription>
                </DialogHeader>

                <div class="flex flex-col gap-4 py-4">
                    <div v-if="selectedRecommended?.requiresApiKey" class="flex flex-col gap-2">
                        <label for="recommended-api-key" class="text-sm font-medium">API Key *</label>
                        <Input
                            id="recommended-api-key"
                            v-model="recommendedApiKey"
                            type="password"
                            :placeholder="selectedRecommended?.apiKeyPlaceholder || '请输入 API Key'"
                        />
                        <p v-if="selectedRecommended?.learnMoreUrl" class="text-xs text-text-300">
                            前往
                            <a
                                :href="selectedRecommended.learnMoreUrl"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-accent hover:underline"
                            >官网</a>
                            获取 API Key
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <button
                        class="px-4 py-2 text-text-200 hover:bg-bg-200 rounded-lg transition-colors"
                        @click="isAddRecommendedDialogOpen = false"
                    >
                        取消
                    </button>
                    <button
                        class="px-4 py-2 bg-text-100 text-bg-100 rounded-lg hover:opacity-90 transition-colors"
                        @click="handleAddRecommendedServer"
                    >
                        添加
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
</template>

<style scoped>
/* 标题样式 */
.section-title {
    font-weight: bold;
    color: var(--color-text);
    margin-bottom: 0.5rem;
}
</style>
