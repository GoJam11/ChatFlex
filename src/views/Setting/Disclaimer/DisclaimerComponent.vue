<template>
    <div class="flex flex-col gap-6">
        <!-- 页头 -->
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-lg font-semibold text-text-100">{{ t('about.disclaimer') }}</h2>
                <p class="text-sm text-text-300 mt-1">
                    {{ t('disclaimer.pageDescription') }}
                </p>
            </div>
        </div>

        <div class="setting-description">
            <p><strong>{{ t('about.terms.serviceNature.title') }}</strong></p>
            <p>
                {{ t('about.terms.serviceNature.content') }}
            </p>

            <p><strong>{{ t('about.terms.contentResponsibility.title') }}</strong></p>
            <p>
                {{ t('about.terms.contentResponsibility.content') }}
            </p>

            <p><strong>{{ t('about.terms.usageRisk.title') }}</strong></p>
            <p>
                {{ t('about.terms.usageRisk.content') }}
            </p>

            <p><strong>{{ t('about.terms.dataSecurity.title') }}</strong></p>
            <p>
                {{ t('about.terms.dataSecurity.content') }}
            </p>

            <p><strong>{{ t('about.terms.complianceUsage.title') }}</strong></p>
            <p>
                {{ t('about.terms.complianceUsage.content') }}
            </p>

            <p><strong>{{ t('about.terms.serviceChanges.title') }}</strong></p>
            <p>
                {{ t('about.terms.serviceChanges.content') }}
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<style scoped>
.disclaimer-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: 100%;
    overflow: auto;
}

.section-title {
    font-weight: bold;
    color: var(--color-text);
    margin-bottom: 0.5rem;
}

.setting-description {
    font-size: 0.75rem;
    color: var(--text-secondary-color);
    margin-top: 0.5rem;
    line-height: 1.5;
}

.setting-description p {
    margin-bottom: 0.75rem;
}

.setting-description strong {
    color: var(--color-text);
    font-weight: 600;
}
</style>
