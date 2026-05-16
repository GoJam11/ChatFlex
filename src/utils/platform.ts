const PLATFORM = typeof navigator !== "undefined" ? navigator.platform : "";
const USER_AGENT = typeof navigator !== "undefined" ? navigator.userAgent : "";
const MAC_PLATFORM_PATTERN = /Mac|iPod|iPhone|iPad/;
const MAC_USER_AGENT_PATTERN = /Mac OS X/;

const hasPlatformInfo = Boolean(PLATFORM || USER_AGENT);

export const isMacPlatform =
    hasPlatformInfo &&
    (MAC_PLATFORM_PATTERN.test(PLATFORM) || MAC_USER_AGENT_PATTERN.test(USER_AGENT));

export function isWindowsPlatform(): boolean {
    if (!PLATFORM) {
        return false;
    }

    return PLATFORM.startsWith("Win");
}
