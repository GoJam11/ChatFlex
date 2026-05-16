interface ModelCapacity {
    supportsVision: boolean;
}

export const modelCapacities = new Map<string, ModelCapacity>([
    // OpenAI Models
    ["gpt-4o", { supportsVision: true }],
    ["gpt-4o-mini", { supportsVision: true }],
    ["gpt-4-turbo", { supportsVision: true }],
    ["gpt-4-turbo-2024-04-09", { supportsVision: true }],
    ["gpt-4-vision-preview", { supportsVision: true }],
    ["gpt-4", { supportsVision: false }],
    ["gpt-3.5-turbo", { supportsVision: false }],
    
    // Claude Models
    ["claude-3-5-sonnet-20241022", { supportsVision: true }],
    ["claude-3-5-sonnet-20240620", { supportsVision: true }],
    ["claude-3-5-haiku-20241022", { supportsVision: true }],
    ["claude-3-opus-20240229", { supportsVision: true }],
    ["claude-3-sonnet-20240229", { supportsVision: true }],
    ["claude-3-haiku-20240307", { supportsVision: true }],
    
    // Gemini Models
    ["gemini-1.5-pro", { supportsVision: true }],
    ["gemini-1.5-flash", { supportsVision: true }],
    ["gemini-pro-vision", { supportsVision: true }],
    ["gemini-pro", { supportsVision: false }],
    
    // DeepSeek Models
    ["deepseek-chat", { supportsVision: false }],
    ["deepseek-reasoner", { supportsVision: false }],
    ["deepseek-r1", { supportsVision: false }],
    
    // Other Models
    ["llava-1.5-7b", { supportsVision: true }],
    ["llava-1.5-13b", { supportsVision: true }],
    ["qwen-vl-chat", { supportsVision: true }],
    ["qwen-vl-plus", { supportsVision: true }],
    ["qwen-vl-max", { supportsVision: true }],
]);

export function supportsVision(modelName: string): boolean {
    const capacity = modelCapacities.get(modelName);
    return capacity?.supportsVision ?? false;
}

export type VisionSupportStatus = 'supported' | 'unsupported' | 'unknown';

export function getVisionSupportStatus(modelName: string): VisionSupportStatus {
    const capacity = modelCapacities.get(modelName);
    if (capacity === undefined) {
        return 'unknown';
    }
    return capacity.supportsVision ? 'supported' : 'unsupported';
}