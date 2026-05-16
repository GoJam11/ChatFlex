export function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|\s]/g, "_");
}

export function inferImageExtensionFromMime(
    mimeType: string | null | undefined,
    defaultExtension = "png"
): string {
    if (!mimeType) {
        return defaultExtension;
    }

    const [type, subtype] = mimeType.split("/");
    if (!type || !subtype || type.toLowerCase() !== "image") {
        return defaultExtension;
    }

    const normalized = subtype.split("+")[0].toLowerCase();
    if (normalized === "jpeg") {
        return "jpg";
    }

    return normalized || defaultExtension;
}

export function buildImageFileName(options: {
    candidateName?: string | null;
    fallbackBase: string;
    mimeType?: string | null;
    defaultExtension?: string;
}): string {
    const { candidateName, fallbackBase, mimeType, defaultExtension = "png" } = options;

    const trimmedCandidate = candidateName?.trim() ?? "";
    const sanitizedCandidate =
        trimmedCandidate.length > 0 ? sanitizeFileName(trimmedCandidate) : "";

    const sanitizedFallback = sanitizeFileName(fallbackBase);
    const safeFallback = sanitizedFallback.length > 0 ? sanitizedFallback : fallbackBase;
    const baseName = sanitizedCandidate.length > 0 ? sanitizedCandidate : safeFallback;

    if (baseName.includes(".")) {
        return baseName;
    }

    const extension = inferImageExtensionFromMime(mimeType, defaultExtension);
    return `${baseName}.${extension}`;
}
