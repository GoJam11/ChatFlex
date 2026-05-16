import { createSharedComposable } from "@vueuse/core";
import { remark } from "remark";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { h, VNode } from "vue";

// 渲染器组件
import CodeBlock from "./markdown-renderers/code-block.vue";
import InlineCode from "./markdown-renderers/inline-code.vue";
import MarkdownImage from "./markdown-renderers/markdown-image.vue";
import MarkdownLink from "./markdown-renderers/markdown-link.vue";

interface MarkdownNode {
    type: string;
    value?: string;
    children?: MarkdownNode[];
    depth?: number;
    lang?: string;
    meta?: string;
    url?: string;
    title?: string;
    alt?: string;
    ordered?: boolean;
    start?: number;
    checked?: boolean | null;
    align?: ("left" | "right" | "center" | null)[];
    position?: any;
}

/**
 * 创建 Remark 渲染器实例
 * 支持流式输出动画 - 为每个节点添加 fade-in 动画类
 */
const _useRemarkRenderer = () => {
    const processor = remark().use(remarkParse).use(remarkGfm);

    /**
     * 渲染 Markdown 内容为 Vue VNode
     * @param content Markdown 内容
     * @param enableAnimation 是否启用动画效果
     * @returns Vue VNode 数组
     */
    const renderMarkdown = (
        content: string,
        enableAnimation = false
    ): (VNode | string)[] => {
        try {
            const ast = processor.parse(content);
            return astToVNodes(ast as MarkdownNode, enableAnimation);
        } catch (error) {
            console.error("Markdown 渲染失败:", error);
            return [h("div", { class: "markdown-error" }, "Markdown 渲染失败")];
        }
    };

    /**
     * 将 AST 节点转换为 Vue VNode
     * @param node AST 节点
     * @param enableAnimation 是否启用动画效果
     * @returns Vue VNode 数组
     */
    const astToVNodes = (
        node: MarkdownNode,
        enableAnimation = false
    ): (VNode | string)[] => {
        if (!node) return [];

        // 为支持动画的节点添加动画类
        const animationProps = enableAnimation
            ? { class: "markdown-fade-in" }
            : {};

        switch (node.type) {
            case "root":
                return (
                    node.children?.flatMap((child) =>
                        astToVNodes(child, enableAnimation)
                    ) || []
                );

            case "paragraph":
                return [
                    h(
                        "p",
                        animationProps,
                        node.children?.flatMap((child) =>
                            astToVNodes(child, enableAnimation)
                        ) || []
                    ),
                ];

            case "heading": {
                const headingTag = `h${node.depth}`;
                return [
                    h(
                        headingTag,
                        animationProps,
                        node.children?.flatMap((child) =>
                            astToVNodes(child, enableAnimation)
                        ) || []
                    ),
                ];
            }

            case "text":
                return [node.value || ""];

            case "strong":
                return [
                    h(
                        "strong",
                        {},
                        node.children?.flatMap((child) =>
                            astToVNodes(child, enableAnimation)
                        ) || []
                    ),
                ];

            case "emphasis":
                return [
                    h(
                        "em",
                        {},
                        node.children?.flatMap((child) =>
                            astToVNodes(child, enableAnimation)
                        ) || []
                    ),
                ];

            case "link":
                return [
                    h(
                        MarkdownLink,
                        {
                            href: node.url || "",
                            title: node.title,
                        },
                        {
                            default: () =>
                                node.children?.flatMap((child) =>
                                    astToVNodes(child, enableAnimation)
                                ) || [],
                        }
                    ),
                ];

            case "inlineCode":
                return [h(InlineCode, { code: node.value || "" })];

            case "code":
                return [
                    h(CodeBlock, {
                        code: node.value || "",
                        language: node.lang || "",
                        meta: node.meta,
                        enableAnimation,
                    }),
                ];

            case "blockquote":
                return [
                    h(
                        "blockquote",
                        animationProps,
                        node.children?.flatMap((child) =>
                            astToVNodes(child, enableAnimation)
                        ) || []
                    ),
                ];

            case "list": {
                const listTag = node.ordered ? "ol" : "ul";
                const listProps = {
                    ...animationProps,
                    ...(node.ordered &&
                    node.start !== undefined &&
                    node.start !== 1
                        ? { start: node.start }
                        : {}),
                };
                return [
                    h(
                        listTag,
                        listProps,
                        node.children?.flatMap((child) =>
                            astToVNodes(child, enableAnimation)
                        ) || []
                    ),
                ];
            }

            case "listItem":
                return [
                    h(
                        "li",
                        {},
                        node.children?.flatMap((child) =>
                            astToVNodes(child, enableAnimation)
                        ) || []
                    ),
                ];

            case "thematicBreak":
                return [h("hr", animationProps)];

            case "break":
                return [h("br")];

            case "table":
                return [
                    h("table", animationProps, [
                        h(
                            "tbody",
                            {},
                            node.children?.flatMap((child) =>
                                astToVNodes(child, enableAnimation)
                            ) || []
                        ),
                    ]),
                ];

            case "tableRow":
                return [
                    h(
                        "tr",
                        {},
                        node.children?.flatMap((child) =>
                            astToVNodes(child, enableAnimation)
                        ) || []
                    ),
                ];

            case "tableCell":
                return [
                    h(
                        "td",
                        {},
                        node.children?.flatMap((child) =>
                            astToVNodes(child, enableAnimation)
                        ) || []
                    ),
                ];

            case "delete":
                return [
                    h(
                        "del",
                        {},
                        node.children?.flatMap((child) =>
                            astToVNodes(child, enableAnimation)
                        ) || []
                    ),
                ];

            case "image":
                return [
                    h(MarkdownImage, {
                        src: node.url || "",
                        alt: node.alt || "",
                        title: node.title,
                        enableAnimation,
                    }),
                ];

            default:
                // 处理未知节点类型
                console.warn("未知的 Markdown 节点类型:", node.type, node);
                return (
                    node.children?.flatMap((child) =>
                        astToVNodes(child, enableAnimation)
                    ) || []
                );
        }
    };

    return {
        renderMarkdown,
        processor,
    };
};

/**
 * 使用 createSharedComposable 创建共享的 Remark 渲染器实例
 */
export const useRemarkRenderer = createSharedComposable(_useRemarkRenderer);
