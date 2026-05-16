<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { ImageDataService } from "@/features/msg/images/imageDataService";
import { Spinner } from "@/components/ui/spinner";
import { Image } from "@/components/ui/image";
import { ImageData } from "@/types/msg.ts";
import { isTauri } from "@tauri-apps/api/core";
import { join, tempDir } from "@tauri-apps/api/path";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { buildImageFileName } from "@/features/msg/images/imagePreviewUtils";

const props = defineProps<{
    imageData: ImageData;
}>();
const imageUrl = ref<string | null>(null);
const isLoading = ref(true);
const hasError = ref(false);
const imageService = ImageDataService.getInstance();
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

async function loadImage() {
    if (!props.imageData || typeof props.imageData.imageId !== "number") {
        console.error(
            "ImageDisplayComponent: Invalid imageData or imageId",
            props.imageData
        );
        isLoading.value = false;
        hasError.value = true;
        return;
    }
    isLoading.value = true;
    hasError.value = false;
    try {
        const blobUrl = await imageService.getBlobUrl(props.imageData.imageId);
        if (blobUrl) {
            imageUrl.value = blobUrl;
        } else {
            console.error(
                `ImageDisplayComponent: Failed to get blob URL for imageId ${props.imageData.imageId}`
            );
            hasError.value = true;
        }
    } catch (error) {
        console.error(
            `ImageDisplayComponent: Error loading image ${props.imageData.imageId}`,
            error
        );
        hasError.value = true;
    } finally {
        isLoading.value = false;
    }
}

async function openImagePreview() {
    if (!imageUrl.value || hasError.value || isPreviewing.value) {
        return;
    }

    if (!isTauriEnv) {
        if (typeof window !== "undefined") {
            window.open(imageUrl.value, "_blank");
        }
        return;
    }

    try {
        isPreviewing.value = true;

        // 优先使用文件系统路径直接打开
        const filePath = await imageService.getImageFilePath(props.imageData.imageId);
        if (filePath) {
            await openPath(filePath);
            return;
        }

        // 兼容旧数据：从 Blob 写入临时文件
        const record = await imageService.findById(props.imageData.imageId);
        if (!record?.blob) {
            console.error(
                `ImageDisplayComponent: Unable to find image record for preview ${props.imageData.imageId}`
            );
            return;
        }

        const buffer = await record.blob.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        const fileName = buildImageFileName({
            candidateName: record?.name,
            fallbackBase: `chatflex_image_${props.imageData.imageId}`,
            mimeType: record?.mimeType,
        });

        await openImageWithTauri(bytes, fileName);
    } catch (error) {
        console.error(
            `ImageDisplayComponent: Failed to open image preview ${props.imageData.imageId}`,
            error
        );
    } finally {
        isPreviewing.value = false;
    }
}

onMounted(() => {
    loadImage();
});

watch(
    () => props.imageData.imageId,
    (newId, oldId) => {
        if (newId !== oldId) {
            if (imageUrl.value) {
                imageService.releaseBlobUrl(imageUrl.value); // Release old URL if it exists
                imageUrl.value = null; // Reset before loading new one
            }
            loadImage();
        }
    }
);

onUnmounted(() => {
    if (imageUrl.value) {
        imageService.releaseBlobUrl(imageUrl.value);
    }
});

</script>

<template>
    <div class="image-display-container my-2">
        <div v-if="isLoading" class="flex items-center justify-center p-4">
            <Spinner size="small" />
            <span class="ml-2 text-sm text-gray-500">图片加载中...</span>
        </div>
        <Image
            v-else-if="imageUrl && !hasError"
            :src="imageUrl"
            :alt="imageData.alt || '用户图片'"
            class="image-display"
            class-name="image-display-img"
            :preview="true"
            @preview="openImagePreview"
            @click="openImagePreview"
            @error="hasError = true"
        />
        <div
            v-else-if="hasError"
            class="text-red-500 text-sm p-2 bg-red-100 border border-red-300 rounded"
        >
            图片加载失败 (ID: {{ imageData.imageId }})
        </div>
    </div>
</template>

<style scoped>
.image-display-container img {
    display: block; /* Prevents bottom space under image */
}

.image-display {
    display: inline-flex;
    max-width: 100%;
}

.image-display-img {
    display: block;
    max-width: min(200px, 100%);
    max-height: 200px;
    width: auto;
    height: auto;
    border-radius: 8px;
    object-fit: cover;
    cursor: pointer;
}
</style>
