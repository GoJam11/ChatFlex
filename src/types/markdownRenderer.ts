/**
 * 增强Markdown渲染相关类型定义
 */

export interface MarkdownRenderOptions {
    enableCharts?: boolean;         // 启用图表
    enableTables?: boolean;         // 启用表格
    enableCodeHighlight?: boolean;  // 启用代码高亮
    enableEmoji?: boolean;          // 启用表情符号
    enableTaskLists?: boolean;      // 启用任务列表
    enableFootnotes?: boolean;      // 启用脚注
    enableLinkCards?: boolean;      // 启用链接卡片
    enableCollapsible?: boolean;    // 启用折叠块
    theme?: 'light' | 'dark';      // 主题
    chartRenderer?: 'mermaid' | 'echarts';  // 图表渲染器
}

export interface MarkdownRenderResult {
    html: string;
    metadata: MarkdownMetadata;
    performance: MarkdownPerformance;
    errors?: string[];
    warnings?: string[];
}

export interface MarkdownMetadata {
    headings: HeadingInfo[];
    links: LinkInfo[];
    images: ImageInfo[];
    codeBlocks: CodeBlockInfo[];
    charts: ChartInfo[];
    tables: TableInfo[];
    wordCount: number;
    readingTime: number;  // 预估阅读时间（分钟）
    toc: TableOfContents[];  // 目录
}

export interface HeadingInfo {
    level: number;
    text: string;
    id: string;
    anchor: string;
}

export interface LinkInfo {
    text: string;
    url: string;
    title?: string;
    isExternal: boolean;
    isEmail: boolean;
}

export interface ImageInfo {
    src: string;
    alt: string;
    title?: string;
    width?: number;
    height?: number;
}

export interface CodeBlockInfo {
    language: string;
    code: string;
    lineCount: number;
    isExecutable: boolean;
}

export interface ChartInfo {
    type: 'mermaid' | 'echarts' | 'plantuml';
    code: string;
    id: string;
    config?: any;
}

export interface TableInfo {
    headers: string[];
    rows: string[][];
    alignment: ('left' | 'center' | 'right')[];
}

export interface TableOfContents {
    level: number;
    text: string;
    anchor: string;
    children: TableOfContents[];
}

export interface MarkdownPerformance {
    renderTime: number;     // 渲染时间（毫秒）
    chartRenderTime?: number; // 图表渲染时间
    codeHighlightTime?: number; // 代码高亮时间
    totalTime: number;      // 总时间
}

/**
 * 增强Markdown渲染服务接口
 */
export interface IEnhancedMarkdownRenderer {
    /**
     * 渲染Markdown
     */
    render(markdown: string, options?: MarkdownRenderOptions): Promise<MarkdownRenderResult>;

    /**
     * 渲染图表
     */
    renderChart(chartCode: string, type: ChartInfo['type']): Promise<string>;

    /**
     * 生成目录
     */
    generateTOC(markdown: string): Promise<TableOfContents[]>;

    /**
     * 提取元数据
     */
    extractMetadata(markdown: string): Promise<MarkdownMetadata>;

    /**
     * 预览模式渲染
     */
    renderPreview(markdown: string): Promise<string>;

    /**
     * 获取支持的功能
     */
    getSupportedFeatures(): MarkdownFeature[];
}

export type MarkdownFeature = 
    | 'charts'
    | 'tables'
    | 'code-highlight'
    | 'emoji'
    | 'task-lists'
    | 'footnotes'
    | 'link-cards'
    | 'collapsible';

/**
 * 自定义Markdown扩展
 */
export interface MarkdownExtension {
    name: string;
    pattern: RegExp;
    renderer: (match: RegExpMatchArray, options?: any) => string;
    priority: number;
}

/**
 * 图表配置
 */
export interface ChartConfig {
    mermaid: {
        theme: 'default' | 'dark' | 'forest' | 'neutral';
        fontFamily: string;
        fontSize: number;
        backgroundColor: string;
    };
    echarts: {
        theme: string;
        renderer: 'canvas' | 'svg';
        devicePixelRatio: number;
    };
}

/**
 * 代码高亮配置
 */
export interface CodeHighlightConfig {
    theme: string;
    languages: string[];
    showLineNumbers: boolean;
    wrapLines: boolean;
    maxLines?: number;
}

/**
 * 表格增强配置
 */
export interface TableConfig {
    enableSorting: boolean;
    enableFiltering: boolean;
    enablePagination: boolean;
    pageSize: number;
    maxRows?: number;
    stripedRows: boolean;
    hoverEffect: boolean;
}

/**
 * 链接卡片配置
 */
export interface LinkCardConfig {
    enablePreview: boolean;
    showFavicon: boolean;
    showImage: boolean;
    showDescription: boolean;
    maxDescriptionLength: number;
    cacheExpiry: number; // 缓存过期时间（秒）
}

/**
 * 折叠块配置
 */
export interface CollapsibleConfig {
    defaultOpen: boolean;
    animationDuration: number;
    maxHeight?: number;
}

/**
 * Markdown渲染器配置
 */
export interface MarkdownRendererConfig {
    options: MarkdownRenderOptions;
    extensions: MarkdownExtension[];
    charts: ChartConfig;
    codeHighlight: CodeHighlightConfig;
    tables: TableConfig;
    linkCards: LinkCardConfig;
    collapsible: CollapsibleConfig;
}

/**
 * 渲染缓存
 */
export interface RenderCache {
    key: string;
    markdown: string;
    result: MarkdownRenderResult;
    timestamp: number;
    hits: number;
}

/**
 * 批量渲染任务
 */
export interface BatchRenderTask {
    id: string;
    markdown: string;
    options?: MarkdownRenderOptions;
    priority: number;
    callback?: (result: MarkdownRenderResult) => void;
}

/**
 * 实时预览配置
 */
export interface LivePreviewConfig {
    debounceDelay: number;      // 防抖延迟（毫秒）
    enableScrollSync: boolean;  // 启用滚动同步
    enableCursorSync: boolean;  // 启用光标同步
    updateMode: 'full' | 'incremental';  // 更新模式
}

/**
 * Markdown编辑器状态
 */
export interface MarkdownEditorState {
    content: string;
    cursorPosition: number;
    selectionStart: number;
    selectionEnd: number;
    scrollTop: number;
    isDirty: boolean;
    lastSaved: number;
}
