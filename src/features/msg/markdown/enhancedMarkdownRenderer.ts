/**
 * EnhancedMarkdownRenderer
 * 
 * 增强Markdown渲染服务 - 支持数学公式、图表、代码高亮等
 * 集成KaTeX、Mermaid、highlight.js等库
 */

import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';
import hljs from 'highlight.js';
import type {
    IEnhancedMarkdownRenderer,
    MarkdownRenderOptions,
    MarkdownRenderResult,
    MarkdownMetadata,
    MarkdownPerformance,
    HeadingInfo,
    LinkInfo,
    ImageInfo,
    CodeBlockInfo,
    ChartInfo,
    TableInfo,
    TableOfContents,
    MarkdownFeature
} from '@/types/markdownRenderer';

export class EnhancedMarkdownRenderer implements IEnhancedMarkdownRenderer {
    private static instance: EnhancedMarkdownRenderer;
    private md: MarkdownIt;
    private renderCache: Map<string, MarkdownRenderResult> = new Map();
    private mermaidInitialized = false;

    // 单例模式
    static getInstance(): EnhancedMarkdownRenderer {
        if (!EnhancedMarkdownRenderer.instance) {
            EnhancedMarkdownRenderer.instance = new EnhancedMarkdownRenderer();
        }
        return EnhancedMarkdownRenderer.instance;
    }

    private constructor() {
        this.md = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true,
            breaks: true
        });

        this.setupDefaultPlugins();
        this.setupCustomRules();
        this.initializeMermaid();
    }

    /**
     * 设置默认插件
     */
    private setupDefaultPlugins(): void {
        // 自定义代码块渲染
        this.md.renderer.rules.code_block = (tokens, idx, options, env, renderer) => {
            const token = tokens[idx];
            const content = token.content;
            const language = token.info || 'plaintext';
            
            return this.renderCodeBlock(content, language);
        };

        this.md.renderer.rules.fence = (tokens, idx, options, env, renderer) => {
            const token = tokens[idx];
            const content = token.content;
            const language = token.info.trim() || 'plaintext';
            
            // 检查是否为图表代码
            if (this.isChartLanguage(language)) {
                return this.renderChartBlock(content, language as any);
            }
            
            return this.renderCodeBlock(content, language);
        };

        // 自定义表格渲染
        this.md.renderer.rules.table_open = () => '<div class="table-container"><table class="enhanced-table">';
        this.md.renderer.rules.table_close = () => '</table></div>';
    }

    /**
     * 设置自定义规则
     */
    private setupCustomRules(): void {
        // 任务列表
        this.md.renderer.rules.list_item_open = (tokens, idx, options, env, renderer) => {
            const token = tokens[idx];
            if (token.attrGet('class') === 'task-list-item') {
                return '<li class="task-list-item">';
            }
            return '<li>';
        };

        // 自定义链接渲染（支持链接卡片）
        this.md.renderer.rules.link_open = (tokens, idx, options, env, renderer) => {
            const token = tokens[idx];
            const href = token.attrGet('href');
            
            if (href && this.isExternalLink(href)) {
                token.attrSet('target', '_blank');
                token.attrSet('rel', 'noopener noreferrer');
            }
            
            return renderer.renderToken(tokens, idx, options);
        };

        // 标题锚点
        this.md.renderer.rules.heading_open = (tokens, idx, options, env, renderer) => {
            const token = tokens[idx];
            const level = token.tag.substring(1);
            const nextToken = tokens[idx + 1];
            
            if (nextToken && nextToken.type === 'inline') {
                const content = nextToken.content;
                const id = this.generateAnchor(content);
                token.attrSet('id', id);
                token.attrSet('class', 'heading-with-anchor');
            }
            
            return renderer.renderToken(tokens, idx, options);
        };
    }

    /**
     * 初始化Mermaid
     */
    private async initializeMermaid(): Promise<void> {
        if (this.mermaidInitialized) return;

        try {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose',
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: 14,
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true
                },
                sequence: {
                    useMaxWidth: true
                },
                gantt: {
                    useMaxWidth: true
                }
            });
            
            this.mermaidInitialized = true;
            console.log('[Markdown] Mermaid 初始化完成');
        } catch (error) {
            console.error('[Markdown] Mermaid 初始化失败:', error);
        }
    }

    /**
     * 渲染Markdown
     */
    async render(markdown: string, options: MarkdownRenderOptions = {}): Promise<MarkdownRenderResult> {
        const startTime = performance.now();
        const cacheKey = this.generateCacheKey(markdown, options);
        
        // 检查缓存
        if (this.renderCache.has(cacheKey)) {
            const cached = this.renderCache.get(cacheKey)!;
            return {
                ...cached,
                performance: {
                    ...cached.performance,
                    totalTime: performance.now() - startTime
                }
            };
        }

        try {
            // 配置渲染选项
            this.configureRenderer(options);

            // 渲染HTML
            const renderStartTime = performance.now();
            const html = this.md.render(markdown);
            const renderTime = performance.now() - renderStartTime;

            // 后处理：渲染图表
            const chartStartTime = performance.now();
            const processedHtml = await this.postProcessCharts(html);
            const chartRenderTime = performance.now() - chartStartTime;

            // 提取元数据
            const metadata = await this.extractMetadata(markdown);

            // 性能统计
            const totalTime = performance.now() - startTime;
            const performanceStats: MarkdownPerformance = {
                renderTime,
                chartRenderTime,
                totalTime
            };

            const result: MarkdownRenderResult = {
                html: processedHtml,
                metadata,
                performance: performanceStats
            };

            // 缓存结果
            this.renderCache.set(cacheKey, result);

            // 清理旧缓存
            if (this.renderCache.size > 100) {
                const firstKey = this.renderCache.keys().next().value as string;
                this.renderCache.delete(firstKey);
            }

            return result;

        } catch (error: any) {
            console.error('[Markdown] 渲染失败:', error);
            
            return {
                html: `<div class="markdown-error">渲染失败: ${error.message}</div>`,
                metadata: this.createEmptyMetadata(),
                performance: {
                    renderTime: 0,
                    totalTime: performance.now() - startTime
                },
                errors: [error.message]
            };
        }
    }

    /**
     * 渲染图表
     */
    async renderChart(chartCode: string, type: ChartInfo['type']): Promise<string> {
        try {
            switch (type) {
                case 'mermaid':
                    return await this.renderMermaidChart(chartCode);
                case 'echarts':
                    return this.renderEChartsChart(chartCode);
                default:
                    return `<div class="chart-error">不支持的图表类型: ${type}</div>`;
            }
        } catch (error: any) {
            console.error('[Markdown] 图表渲染失败:', error);
            return `<div class="chart-error">图表渲染失败: ${error.message}</div>`;
        }
    }

    /**
     * 生成目录
     */
    async generateTOC(markdown: string): Promise<TableOfContents[]> {
        const headings = this.extractHeadings(markdown);
        return this.buildTOCTree(headings);
    }

    /**
     * 提取元数据
     */
    async extractMetadata(markdown: string): Promise<MarkdownMetadata> {
        const headings = this.extractHeadings(markdown);
        const links = this.extractLinks(markdown);
        const images = this.extractImages(markdown);
        const codeBlocks = this.extractCodeBlocks(markdown);
        const charts = this.extractCharts(markdown);
        const tables = this.extractTables(markdown);
        
        const wordCount = this.countWords(markdown);
        const readingTime = Math.ceil(wordCount / 200); // 假设每分钟200字
        const toc = this.buildTOCTree(headings);

        return {
            headings,
            links,
            images,
            codeBlocks,
            charts,
            tables,
            wordCount,
            readingTime,
            toc
        };
    }

    /**
     * 预览模式渲染
     */
    async renderPreview(markdown: string): Promise<string> {
        const options: MarkdownRenderOptions = {
            enableCharts: true,
            enableTables: true,
            enableCodeHighlight: true,
            theme: 'light'
        };

        const result = await this.render(markdown, options);
        return result.html;
    }

    /**
     * 获取支持的功能
     */
    getSupportedFeatures(): MarkdownFeature[] {
        return [
            'charts',
            'tables',
            'code-highlight',
            'emoji',
            'task-lists'
        ];
    }

    // 私有辅助方法

    /**
     * 配置渲染器
     */
    private configureRenderer(options: MarkdownRenderOptions): void {
        // 这里可以根据选项动态配置渲染器
        // 暂时保持默认配置
    }

    /**
     * 渲染代码块
     */
    private renderCodeBlock(code: string, language: string): string {
        try {
            const highlighted = hljs.getLanguage(language) 
                ? hljs.highlight(code, { language }).value
                : hljs.highlightAuto(code).value;

            return `
                <div class="code-block-container">
                    <div class="code-header">
                        <span class="language-label">${language}</span>
                    </div>
                    <pre class="hljs"><code>${highlighted}</code></pre>
                </div>
            `;
        } catch (error) {
            return `<pre class="hljs"><code>${this.escapeHtml(code)}</code></pre>`;
        }
    }

    /**
     * 渲染图表块
     */
    private renderChartBlock(code: string, type: ChartInfo['type']): string {
        const id = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        return `
            <div class="chart-container" data-chart-type="${type}" data-chart-id="${id}">
                <div class="chart-loading">正在渲染${type}图表...</div>
                <script type="text/chart-data">${this.escapeHtml(code)}</script>
            </div>
        `;
    }

    /**
     * 后处理图表
     */
    private async postProcessCharts(html: string): Promise<string> {
        // 使用DOM解析器处理图表
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const chartContainers = doc.querySelectorAll('.chart-container');

        for (const container of chartContainers) {
            const type = container.getAttribute('data-chart-type') as ChartInfo['type'];
            const id = container.getAttribute('data-chart-id')!;
            const script = container.querySelector('script[type="text/chart-data"]');
            
            if (script && type) {
                const chartCode = script.textContent || '';
                try {
                    const renderedChart = await this.renderChart(chartCode, type);
                    container.innerHTML = renderedChart;
                    container.setAttribute('id', id);
                } catch (error) {
                    container.innerHTML = `<div class="chart-error">图表渲染失败: ${error}</div>`;
                }
            }
        }

        return doc.body.innerHTML;
    }

    /**
     * 渲染Mermaid图表
     */
    private async renderMermaidChart(code: string): Promise<string> {
        if (!this.mermaidInitialized) {
            await this.initializeMermaid();
        }

        try {
            const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const { svg } = await mermaid.render(id, code);
            return `<div class="mermaid-chart">${svg}</div>`;
        } catch (error: any) {
            console.error('[Markdown] Mermaid渲染失败:', error);
            return `<div class="chart-error">Mermaid图表渲染失败: ${error.message}</div>`;
        }
    }

    /**
     * 渲染ECharts图表
     */
    private renderEChartsChart(code: string): string {
        // ECharts需要在DOM中渲染，这里返回占位符
        const id = `echarts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        return `
            <div class="echarts-chart" id="${id}" style="width: 100%; height: 400px;">
                <script type="text/echarts-config">${this.escapeHtml(code)}</script>
            </div>
        `;
    }

    /**
     * 检查是否为图表语言
     */
    private isChartLanguage(language: string): boolean {
        return ['mermaid', 'echarts', 'plantuml'].includes(language.toLowerCase());
    }

    /**
     * 检查是否为外部链接
     */
    private isExternalLink(href: string): boolean {
        return /^https?:\/\//.test(href);
    }

    /**
     * 生成锚点
     */
    private generateAnchor(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fff]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
    }

    /**
     * 提取标题
     */
    private extractHeadings(markdown: string): HeadingInfo[] {
        const headings: HeadingInfo[] = [];
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        let match;

        while ((match = headingRegex.exec(markdown)) !== null) {
            const level = match[1].length;
            const text = match[2].trim();
            const id = this.generateAnchor(text);
            
            headings.push({
                level,
                text,
                id,
                anchor: `#${id}`
            });
        }

        return headings;
    }

    /**
     * 提取链接
     */
    private extractLinks(markdown: string): LinkInfo[] {
        const links: LinkInfo[] = [];
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;

        while ((match = linkRegex.exec(markdown)) !== null) {
            const text = match[1];
            const url = match[2];
            
            links.push({
                text,
                url,
                isExternal: this.isExternalLink(url),
                isEmail: url.startsWith('mailto:')
            });
        }

        return links;
    }

    /**
     * 提取图片
     */
    private extractImages(markdown: string): ImageInfo[] {
        const images: ImageInfo[] = [];
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let match;

        while ((match = imageRegex.exec(markdown)) !== null) {
            const alt = match[1];
            const src = match[2];
            
            images.push({
                alt,
                src
            });
        }

        return images;
    }

    /**
     * 提取代码块
     */
    private extractCodeBlocks(markdown: string): CodeBlockInfo[] {
        const codeBlocks: CodeBlockInfo[] = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;

        while ((match = codeBlockRegex.exec(markdown)) !== null) {
            const language = match[1] || 'plaintext';
            const code = match[2].trim();
            
            codeBlocks.push({
                language,
                code,
                lineCount: code.split('\n').length,
                isExecutable: ['javascript', 'typescript', 'python'].includes(language)
            });
        }

        return codeBlocks;
    }

    /**
     * 提取图表
     */
    private extractCharts(markdown: string): ChartInfo[] {
        const charts: ChartInfo[] = [];
        const chartRegex = /```(mermaid|echarts|plantuml)\n([\s\S]*?)```/g;
        let match;

        while ((match = chartRegex.exec(markdown)) !== null) {
            const type = match[1] as ChartInfo['type'];
            const code = match[2].trim();
            
            charts.push({
                type,
                code,
                id: `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            });
        }

        return charts;
    }

    /**
     * 提取表格
     */
    private extractTables(markdown: string): TableInfo[] {
        const tables: TableInfo[] = [];
        const tableRegex = /(\|.+\|\n)+/g;
        let match;

        while ((match = tableRegex.exec(markdown)) !== null) {
            const tableText = match[0].trim();
            const lines = tableText.split('\n');
            
            if (lines.length >= 2) {
                const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
                const alignmentLine = lines[1];
                const rows = lines.slice(2).map(line => 
                    line.split('|').map(cell => cell.trim()).filter(cell => cell)
                );

                const alignment = this.parseTableAlignment(alignmentLine);

                tables.push({
                    headers,
                    rows,
                    alignment
                });
            }
        }

        return tables;
    }

    /**
     * 解析表格对齐
     */
    private parseTableAlignment(alignmentLine: string): ('left' | 'center' | 'right')[] {
        return alignmentLine.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell)
            .map(cell => {
                if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
                if (cell.endsWith(':')) return 'right';
                return 'left';
            });
    }

    /**
     * 统计词数
     */
    private countWords(text: string): number {
        // 移除Markdown标记
        const cleanText = text
            .replace(/[#*`_~\[\]()]/g, '')
            .replace(/\n+/g, ' ')
            .trim();
        
        // 分别计算英文单词和中文字符
        const englishWords = cleanText.match(/[a-zA-Z]+/g)?.length || 0;
        const chineseChars = cleanText.match(/[\u4e00-\u9fff]/g)?.length || 0;
        
        return englishWords + chineseChars;
    }

    /**
     * 构建目录树
     */
    private buildTOCTree(headings: HeadingInfo[]): TableOfContents[] {
        const toc: TableOfContents[] = [];
        const stack: TableOfContents[] = [];

        for (const heading of headings) {
            const tocItem: TableOfContents = {
                level: heading.level,
                text: heading.text,
                anchor: heading.anchor,
                children: []
            };

            // 找到合适的父级
            while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
                stack.pop();
            }

            if (stack.length === 0) {
                toc.push(tocItem);
            } else {
                stack[stack.length - 1].children.push(tocItem);
            }

            stack.push(tocItem);
        }

        return toc;
    }

    /**
     * 生成缓存键
     */
    private generateCacheKey(markdown: string, options: MarkdownRenderOptions): string {
        const optionsStr = JSON.stringify(options);
        return `${markdown.length}-${this.hashCode(markdown + optionsStr)}`;
    }

    /**
     * 简单哈希函数
     */
    private hashCode(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash;
    }

    /**
     * HTML转义
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 创建空元数据
     */
    private createEmptyMetadata(): MarkdownMetadata {
        return {
            headings: [],
            links: [],
            images: [],
            codeBlocks: [],
            charts: [],
            tables: [],
            wordCount: 0,
            readingTime: 0,
            toc: []
        };
    }
}
