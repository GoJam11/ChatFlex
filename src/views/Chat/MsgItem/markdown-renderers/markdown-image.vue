<script setup lang="ts">
import { computed, ref } from "vue";
import { Image } from "@/components/ui/image";
import { isTauri } from "@tauri-apps/api/core";
import { join, tempDir } from "@tauri-apps/api/path";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { buildImageFileName } from "@/features/msg/images/imagePreviewUtils";
import { imageCacheService } from "@/persistence/imageCacheService";

interface Props {
    src: string;
    alt?: string;
    title?: string;
    enableAnimation?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    alt: "",
    title: "",
    enableAnimation: false,
});

// 动画类
const animationClass = computed(() => {
    return props.enableAnimation ? "markdown-fade-in" : "";
});

const isTauriEnv = typeof window !== "undefined" && isTauri();
const isPreviewing = ref(false);

async function openImageWithTauri(bytes: number[], fileName: string) {
    const tempBase = await tempDir();
    const folderName = `chatflex-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const folderPath = await join(tempBase, folderName);
    await mkdir(folderPath, { recursive: true });

    const safeName = fileName?.trim().length ? fileName : `chatflex_image_${Date.now()}`;
    const filePath = await join(folderPath, safeName);
    await writeFile(filePath, Uint8Array.from(bytes));
    await openPath(filePath);
}

function extractFileNameFromUrl(urlString: string): string | null {
    try {
        const url = new URL(urlString);
        const lastSegment = url.pathname.split("/").filter(Boolean).pop();
        if (lastSegment) {
            return lastSegment.split("?")[0].split("#")[0];
        }
    } catch {
        const segments = urlString.split("/");
        if (segments.length > 0) {
            return segments[segments.length - 1].split("?")[0].split("#")[0];
        }
    }

    return null;
}

async function openImagePreview() {
    if (!props.src || isPreviewing.value) {
        return;
    }

    if (!isTauriEnv) {
        if (typeof window !== "undefined") {
            window.open(props.src, "_blank");
        }
        return;
    }

    try {
        isPreviewing.value = true;

        // 先检查缓存
        const cachedImage = await imageCacheService.getCachedImage(props.src);
        let bytes: number[];
        let fileName: string;
        let mimeType: string | null;

        if (cachedImage) {
            // 使用缓存的图片
            const uint8Array = new Uint8Array(cachedImage.data);
            bytes = Array.from(uint8Array);
            fileName = cachedImage.fileName;
            mimeType = cachedImage.mimeType;
        } else {
            // 从网络下载图片 (使用浏览器原生 fetch)
            const response = await fetch(props.src);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
            }

            const buffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(buffer);
            bytes = Array.from(uint8Array);

            mimeType = response.headers.get("content-type");
            const fallbackBase = `chatflex_image_${Date.now()}`;
            const urlName = props.src ? extractFileNameFromUrl(props.src) : null;
            const altName = props.alt?.trim() || props.title?.trim() || "";
            const candidateName = urlName && urlName.length > 0 ? urlName : altName;
            fileName = buildImageFileName({
                candidateName,
                fallbackBase,
                mimeType,
            });

            // 缓存图片供后续使用
            try {
                await imageCacheService.cacheImage(
                    props.src,
                    uint8Array,
                    mimeType || 'application/octet-stream',
                    fileName
                );
                console.log(`Image cached successfully for ${props.src}`);
            } catch (cacheError) {
                // 缓存失败不影响图片打开
                console.warn(`Failed to cache image for ${props.src}:`, cacheError);
            }
        }

        await openImageWithTauri(bytes, fileName);
    } catch (error) {
        console.error(
            `MarkdownImage: Failed to open image preview for ${props.src}`,
            error
        );
    } finally {
        isPreviewing.value = false;
    }
}
</script>

<template>
    <div class="markdown-image-container max-w-120" :class="animationClass">
        <Image
            :src="src"
            :alt="alt"
            class="markdown-image"
            :preview="true"
            @preview="openImagePreview"
            @click="openImagePreview"
        />
        <div v-if="alt" class="image-caption">
            {{ alt }}
        </div>
    </div>
</template>

<style scoped lang="less">
.markdown-image-container {
    margin: 16px 0;
    text-align: center;

    .markdown-image {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;

        &:hover {
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            transform: translateY(-2px);
        }
    }

    .image-caption {
        margin-top: 8px;
        font-size: 12px;
        color: var(--color-text-secondary);
        font-style: italic;
        text-align: center;
    }
}

// 动画效果
.markdown-fade-in {
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
