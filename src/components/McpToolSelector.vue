<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import { Plug, ChevronDown, Check, RefreshCw, Minus } from "lucide-vue-next";
import { toast } from "vue-sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { mcpDb } from "@/persistence/McpDatabase";
import { mcpClientService, getAvailableMcpTools } from "@/features/mcp/mcpClientService";
import { useChat } from "@/views/Chat/composables/useChat";
import { CREATE_NEW_CHAT } from "@/features/chat/useChatStore";
import type { McpServerConfig } from "@/types/mcp";

const props = defineProps<{
    chatId: string;
}>();

const emit = defineEmits<{
    (e: "change", enabledTools: string[]): void;
}>();

interface McpToolItem {
    id: string;
    serverId: string;
    serverName: string;
    toolName: string;
    description: string;
}

const isOpen = ref(false);
const isLoading = ref(false);
const availableTools = ref<McpToolItem[]>([]);
const enabledToolIds = ref<string[]>([]);
const servers = ref<McpServerConfig[]>([]);
const router = useRouter();
const { createChat } = useChat();

const hasEnabledTools = computed(() => enabledToolIds.value.length > 0);
const enabledCount = computed(() => enabledToolIds.value.length);
const isNewChat = computed(() => props.chatId === CREATE_NEW_CHAT);

const enabledToolLabels = computed(() => {
    if (enabledToolIds.value.length === 0) {
        return [];
    }
    return enabledToolIds.value.map((id) => {
        const tool = availableTools.value.find((item) => item.id === id);
        if (tool) {
            return `${tool.serverName}:${tool.toolName}`;
        }
        return id;
    });
});

const toolsByServer = computed(() => {
    const grouped = new Map<string, McpToolItem[]>();
    for (const tool of availableTools.value) {
        const existing = grouped.get(tool.serverId) || [];
        existing.push(tool);
        grouped.set(tool.serverId, existing);
    }
    return grouped;
});

const loadData = async () => {
    isLoading.value = true;
    try {
        // 加载服务器列表
        servers.value = await mcpDb.getEnabledServers();

        // 加载可用工具
        availableTools.value = await getAvailableMcpTools();

        // 加载当前会话的启用状态
        if (props.chatId && props.chatId !== CREATE_NEW_CHAT) {
            enabledToolIds.value = await mcpDb.getChatMcpToolState(props.chatId);
        } else {
            enabledToolIds.value = [];
        }
    } catch (error) {
        console.error("[McpToolSelector] 加载数据失败:", error);
    } finally {
        isLoading.value = false;
    }
};

const ensureChatReady = async (): Promise<string | null> => {
    if (!isNewChat.value) {
        return props.chatId;
    }

    try {
        const created = await createChat();
        if (!created.success || !created.chat) {
            throw new Error(created.error || "创建新会话失败");
        }
        await router.push({ name: "Chat", params: { uuid: created.chat.id } });
        await nextTick();
        return created.chat.id;
    } catch (error) {
        console.error("[McpToolSelector] 创建会话失败:", error);
        toast.error("创建会话失败");
        return null;
    }
};

const handleToggleTool = async (toolId: string) => {
    try {
        const targetChatId = await ensureChatReady();
        if (!targetChatId) {
            return;
        }

        const isEnabled = enabledToolIds.value.includes(toolId);
        if (isEnabled) {
            await mcpDb.disableMcpToolForChat(targetChatId, toolId);
            enabledToolIds.value = enabledToolIds.value.filter((id) => id !== toolId);
        } else {
            await mcpDb.enableMcpToolForChat(targetChatId, toolId);
            enabledToolIds.value = [...enabledToolIds.value, toolId];
        }
        emit("change", enabledToolIds.value);
    } catch (error) {
        console.error("[McpToolSelector] 切换工具状态失败:", error);
        toast.error("切换工具状态失败");
    }
};

const handleRefresh = async () => {
    isLoading.value = true;
    try {
        await mcpClientService.refreshConnections();
        await loadData();
        toast.success("MCP 服务器已刷新");
    } catch (error) {
        console.error("[McpToolSelector] 刷新失败:", error);
        toast.error("刷新失败");
    } finally {
        isLoading.value = false;
    }
};

const isToolEnabled = (toolId: string): boolean => {
    return enabledToolIds.value.includes(toolId);
};

// 检查某个服务器的所有工具是否都已启用
const isServerAllEnabled = (serverId: string): boolean => {
    const serverTools = toolsByServer.value.get(serverId) || [];
    if (serverTools.length === 0) return false;
    return serverTools.every((tool) => enabledToolIds.value.includes(tool.id));
};

// 检查某个服务器是否有部分工具启用
const isServerPartialEnabled = (serverId: string): boolean => {
    const serverTools = toolsByServer.value.get(serverId) || [];
    if (serverTools.length === 0) return false;
    const enabledInServer = serverTools.filter((tool) => enabledToolIds.value.includes(tool.id));
    return enabledInServer.length > 0 && enabledInServer.length < serverTools.length;
};

// 一键切换服务器所有工具
const handleToggleServer = async (serverId: string) => {
    try {
        const targetChatId = await ensureChatReady();
        if (!targetChatId) {
            return;
        }

        const serverTools = toolsByServer.value.get(serverId) || [];
        const allEnabled = isServerAllEnabled(serverId);

        if (allEnabled) {
            // 全部禁用
            for (const tool of serverTools) {
                await mcpDb.disableMcpToolForChat(targetChatId, tool.id);
            }
            enabledToolIds.value = enabledToolIds.value.filter(
                (id) => !serverTools.some((tool) => tool.id === id)
            );
        } else {
            // 全部启用
            for (const tool of serverTools) {
                if (!enabledToolIds.value.includes(tool.id)) {
                    await mcpDb.enableMcpToolForChat(targetChatId, tool.id);
                }
            }
            const newIds = serverTools
                .map((tool) => tool.id)
                .filter((id) => !enabledToolIds.value.includes(id));
            enabledToolIds.value = [...enabledToolIds.value, ...newIds];
        }
        emit("change", enabledToolIds.value);
    } catch (error) {
        console.error("[McpToolSelector] 切换服务器工具状态失败:", error);
        toast.error("切换工具状态失败");
    }
};

// 监听 chatId 变化，重新加载启用状态
watch(
    () => props.chatId,
    async (newChatId) => {
        if (newChatId && newChatId !== CREATE_NEW_CHAT) {
            enabledToolIds.value = await mcpDb.getChatMcpToolState(newChatId);
        } else {
            enabledToolIds.value = [];
        }
    }
);

onMounted(() => {
    loadData();
});

watch(
    () => isOpen.value,
    (open) => {
        if (open && !isLoading.value) {
            loadData();
        }
    }
);
</script>

<template>
    <TooltipProvider>
        <Tooltip>
            <DropdownMenu v-model:open="isOpen">
                <TooltipTrigger as-child>
                    <DropdownMenuTrigger as-child>
                        <button
                            type="button"
                            class="inline-flex items-center justify-center gap-1 h-8 px-2 rounded-lg transition-colors duration-200 focus:outline-none"
                            :class="[
                                hasEnabledTools
                                    ? 'bg-bg-200 text-text-100 hover:bg-bg-300'
                                    : 'text-text-300 hover:text-text-100 hover:bg-bg-200',
                            ]"
                        >
                            <Plug :size="18" :stroke-width="1.75" />
                            <span v-if="hasEnabledTools" class="text-xs">
                                {{ enabledCount }}
                            </span>
                            <ChevronDown :size="14" :stroke-width="1.75" />
                        </button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">
                    <div class="text-xs">
                        <div class="font-medium">MCP 工具</div>
                        <div v-if="enabledCount > 0">
                            已启用: {{ enabledToolLabels.join(", ") }}
                        </div>
                        <div v-else>
                            未启用
                        </div>
                    </div>
                </TooltipContent>

                <DropdownMenuContent
                    align="start"
                    side="top"
                    class="w-[280px] max-h-[400px] overflow-auto p-1 bg-bg-100 border border-border-200 shadow-lg rounded-xl"
                >
                    <div class="flex items-center justify-between px-2 py-1.5">
                        <span class="text-sm font-medium text-text-100">MCP 工具</span>
                        <button
                            type="button"
                            class="inline-flex items-center justify-center h-8 w-8 rounded-lg text-text-100 hover:bg-bg-200 transition-colors duration-300 focus:outline-none"
                            title="刷新服务器"
                            :disabled="isLoading"
                            @click.stop="handleRefresh"
                        >
                            <RefreshCw
                                :size="14"
                                :class="{ 'animate-spin': isLoading }"
                            />
                        </button>
                    </div>

                    <div class="px-2 pb-1.5 text-xs text-text-100">
                        <div>已启用: {{ enabledCount }}</div>
                        <div v-if="isNewChat" class="text-text-100">
                            新建会话：启用工具会自动创建会话
                        </div>
                        <div v-if="enabledToolLabels.length > 0" class="text-text-100 line-clamp-2">
                            {{ enabledToolLabels.join(", ") }}
                        </div>
                        <div v-else>当前未启用任何 MCP 工具</div>
                    </div>

                    <DropdownMenuSeparator />

                    <div v-if="availableTools.length === 0" class="px-2 py-4 text-center text-sm text-text-100">
                        <template v-if="servers.length === 0">
                            暂无 MCP 服务器，请在设置中添加
                        </template>
                        <template v-else>
                            暂无可用工具，请检查服务器连接
                        </template>
                    </div>

                    <template v-for="[serverId, tools] in toolsByServer" :key="serverId">
                        <div
                            class="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-lg hover:bg-bg-200 transition-colors"
                            @click.stop="handleToggleServer(serverId)"
                        >
                            <div class="w-4 h-4 flex items-center justify-center">
                                <Check
                                    v-if="isServerAllEnabled(serverId)"
                                    :size="14"
                                    class="text-text-100"
                                />
                                <Minus
                                    v-else-if="isServerPartialEnabled(serverId)"
                                    :size="14"
                                    class="text-text-300"
                                />
                            </div>
                            <span class="text-xs font-medium text-text-100 flex-1">
                                {{ tools[0]?.serverName || serverId }}
                            </span>
                            <span class="text-xs text-text-400">
                                全选
                            </span>
                        </div>
                        <DropdownMenuItem
                            v-for="tool in tools"
                            :key="tool.id"
                            class="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-bg-200 cursor-pointer"
                            :class="isToolEnabled(tool.id) ? 'bg-bg-200' : ''"
                            @select.prevent="handleToggleTool(tool.id)"
                        >
                            <div
                                class="w-4 h-4 flex items-center justify-center"
                            >
                                <Check
                                    v-if="isToolEnabled(tool.id)"
                                    :size="14"
                                    class="text-accent"
                                />
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-text-100 truncate">
                                    {{ tool.toolName }}
                                </div>
                                <div
                                    v-if="tool.description"
                                    class="text-xs text-text-100 truncate"
                                >
                                    {{ tool.description }}
                                </div>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator v-if="toolsByServer.size > 1" />
                    </template>
                </DropdownMenuContent>
            </DropdownMenu>
        </Tooltip>
    </TooltipProvider>
</template>
