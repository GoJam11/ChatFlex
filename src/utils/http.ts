import { isTauri } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export async function corsSafeFetch(
    input: URL | Request | string,
    init?: RequestInit
): Promise<Response> {
    try {
        if (typeof window !== "undefined" && isTauri()) {
            return tauriFetch(input, init);
        }
    } catch {
        // Fall back to the browser implementation outside the Tauri runtime.
    }

    return globalThis.fetch(input, init);
}
