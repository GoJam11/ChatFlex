/**
 * 增强Markdown渲染的组合式函数
 */
import { ref, computed, watch } from 'vue';
import { EnhancedMarkdownRenderer } from '@/features/msg/markdown/enhancedMarkdownRenderer';
import type { 
    MarkdownRenderOptions, 
    MarkdownRenderResult, 
    TableOfContents,
    MarkdownMetadata,
    MarkdownFeature
} from '@/types/markdownRenderer';

export function useEnhancedMarkdown(initialOptions?: MarkdownRenderOptions) {
    const markdownRenderer = EnhancedMarkdownRenderer.getInstance();
    
    // 状态
    const content = ref('');
    const isRendering = ref(false);
    const renderResult = ref<MarkdownRenderResult | null>(null);
    const error = ref<string | null>(null);
    const renderOptions = ref<MarkdownRenderOptions>({
        enableCharts: true,
        enableTables: true,
        enableCodeHighlight: true,
        enableEmoji: true,
        enableTaskLists: true,
        theme: 'light',
        ...initialOptions
    });

    // 计算属性
    const renderedHtml = computed(() => {
        return renderResult.value?.html || '';
    });

    const metadata = computed((): MarkdownMetadata | null => {
        return renderResult.value?.metadata || null;
    });

    const tableOfContents = computed((): TableOfContents[] => {
        return metadata.value?.toc || [];
    });

    const renderStats = computed(() => {
        if (!renderResult.value) return null;
        
        const { metadata, performance } = renderResult.value;
        return {
            wordCount: metadata.wordCount,
            readingTime: metadata.readingTime,
            headings: metadata.headings.length,
            links: metadata.links.length,
            images: metadata.images.length,
            codeBlocks: metadata.codeBlocks.length,
            charts: metadata.charts.length,
            tables: metadata.tables.length,
            renderTime: Math.round(performance.totalTime),
            chartRenderTime: performance.chartRenderTime ? Math.round(performance.chartRenderTime) : 0
        };
    });

    const hasContent = computed(() => {
        return content.value && content.value.trim().length > 0;
    });

    const hasErrors = computed(() => {
        return error.value !== null || (renderResult.value?.errors && renderResult.value.errors.length > 0);
    });

    const supportedFeatures = computed((): MarkdownFeature[] => {
        return markdownRenderer.getSupportedFeatures();
    });

    // 方法
    const render = async (markdown?: string, options?: MarkdownRenderOptions): Promise<void> => {
        const markdownContent = markdown || content.value;
        const renderOptionsToUse = options || renderOptions.value;
        
        if (!markdownContent || !markdownContent.trim()) {
            renderResult.value = null;
            error.value = null;
            return;
        }

        isRendering.value = true;
        error.value = null;

        try {
            const result = await markdownRenderer.render(markdownContent, renderOptionsToUse);
            renderResult.value = result;
            
            if (result.errors && result.errors.length > 0) {
                error.value = result.errors.join('; ');
            }
        } catch (err: any) {
            error.value = err.message || '渲染失败';
            renderResult.value = null;
        } finally {
            isRendering.value = false;
        }
    };

    const renderPreview = async (markdown?: string): Promise<string> => {
        const markdownContent = markdown || content.value;
        if (!markdownContent) return '';
        
        try {
            return await markdownRenderer.renderPreview(markdownContent);
        } catch (err) {
            console.error('[useEnhancedMarkdown] 预览渲染失败:', err);
            return '';
        }
    };

    const generateTOC = async (markdown?: string): Promise<TableOfContents[]> => {
        const markdownContent = markdown || content.value;
        if (!markdownContent) return [];
        
        try {
            return await markdownRenderer.generateTOC(markdownContent);
        } catch (err) {
            console.error('[useEnhancedMarkdown] 目录生成失败:', err);
            return [];
        }
    };

    const extractMetadata = async (markdown?: string): Promise<MarkdownMetadata | null> => {
        const markdownContent = markdown || content.value;
        if (!markdownContent) return null;
        
        try {
            return await markdownRenderer.extractMetadata(markdownContent);
        } catch (err) {
            console.error('[useEnhancedMarkdown] 元数据提取失败:', err);
            return null;
        }
    };

    const updateOptions = (newOptions: Partial<MarkdownRenderOptions>): void => {
        renderOptions.value = { ...renderOptions.value, ...newOptions };
    };

    const setContent = (newContent: string): void => {
        content.value = newContent;
    };

    const clearContent = (): void => {
        content.value = '';
        renderResult.value = null;
        error.value = null;
    };

    const retry = (): void => {
        render();
    };

    // 自动渲染监听器
    const enableAutoRender = (debounceMs = 500) => {
        let timeoutId: number | undefined;
        
        return watch(
            [content, renderOptions],
            () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                
                timeoutId = setTimeout(() => {
                    if (hasContent.value) {
                        render();
                    }
                }, debounceMs) as any;
            },
            { deep: true }
        );
    };

    // 性能监控
    const getPerformanceInfo = () => {
        if (!renderResult.value) return null;
        
        const { performance } = renderResult.value;
        return {
            totalTime: performance.totalTime,
            renderTime: performance.renderTime,
            chartRenderTime: performance.chartRenderTime,
            codeHighlightTime: performance.codeHighlightTime
        };
    };

    // 功能检查
    const isFeatureEnabled = (feature: MarkdownFeature): boolean => {
        switch (feature) {
            case 'charts':
                return renderOptions.value.enableCharts || false;
            case 'tables':
                return renderOptions.value.enableTables || false;
            case 'code-highlight':
                return renderOptions.value.enableCodeHighlight || false;
            case 'emoji':
                return renderOptions.value.enableEmoji || false;
            case 'task-lists':
                return renderOptions.value.enableTaskLists || false;
            default:
                return false;
        }
    };

    const toggleFeature = (feature: MarkdownFeature): void => {
        const currentValue = isFeatureEnabled(feature);
        
        switch (feature) {
            case 'charts':
                renderOptions.value.enableCharts = !currentValue;
                break;
            case 'tables':
                renderOptions.value.enableTables = !currentValue;
                break;
            case 'code-highlight':
                renderOptions.value.enableCodeHighlight = !currentValue;
                break;
            case 'emoji':
                renderOptions.value.enableEmoji = !currentValue;
                break;
            case 'task-lists':
                renderOptions.value.enableTaskLists = !currentValue;
                break;
        }
    };

    // 初始化
    return {
        // 状态
        content: computed(() => content.value),
        isRendering: computed(() => isRendering.value),
        renderResult: computed(() => renderResult.value),
        error: computed(() => error.value),
        renderOptions: computed(() => renderOptions.value),
        
        // 计算属性
        renderedHtml,
        metadata,
        tableOfContents,
        renderStats,
        hasContent,
        hasErrors,
        supportedFeatures,
        
        // 方法
        render,
        renderPreview,
        generateTOC,
        extractMetadata,
        updateOptions,
        setContent,
        clearContent,
        retry,
        enableAutoRender,
        getPerformanceInfo,
        isFeatureEnabled,
        toggleFeature
    };
}

export type UseEnhancedMarkdownReturn = ReturnType<typeof useEnhancedMarkdown>;
