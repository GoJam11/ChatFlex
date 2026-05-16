import { isTauri } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export async function corsSafeFetch(
    input: URL | Request | string,
    init?: RequestInit
): Promise<Response> {
    if (typeof window !== "undefined" && isTauri()) {
        try {
            return await tauriFetch(input, init);
        } catch (error) {
            console.warn(
                "[corsSafeFetch] Tauri HTTP fetch failed, falling back to browser fetch:",
                error,
            );
        }
    }

    return globalThis.fetch(input, init);
}
