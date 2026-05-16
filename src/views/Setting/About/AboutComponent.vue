<template>
    <div class="flex flex-col gap-6">
        <!-- 页头 -->
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-lg font-semibold text-text-100">{{ t('about.pageTitle') }}</h2>
                <p class="text-sm text-text-300 mt-1">
                    {{ t('about.pageDescription') }}
                </p>
            </div>
        </div>

        <!-- 产品信息 -->
        <Card>
            <CardContent class="space-y-4">
                <div class="text-center space-y-2">
                    <h2 class="text-2xl font-bold text-primary">
                        ChatFlex
                    </h2>
                    <p class="text-muted-foreground">
                        {{ t('about.subtitle') }}
                    </p>
                </div>
                <div class="text-sm text-muted-foreground leading-relaxed">
                    <p>
                        {{ t('about.description') }}
                    </p>
                </div>
            </CardContent>
        </Card>

        <!-- 项目链接 -->
        <div>
            <p class="section-title">
                {{ t('about.projectLinks') }}
            </p>
            <Card>
                <CardContent class="space-y-4">
                    <div class="text-sm text-muted-foreground">
                        <p class="mb-3">
                            {{ t('about.supportMessage') }}
                        </p>
                        <div class="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                                <a href="https://www.chatflex.app" target="_blank" class="no-underline">
                                    {{ t('about.visitWebsite') }}
                                </a>
                            </Button>
                            <Button variant="outline" size="sm">
                                <a href="https://github.com/GoJam11/ChatFlex" target="_blank" class="no-underline">
                                    {{ t('about.sourceCode') }}
                                </a>
                            </Button>
                            <Button variant="outline" size="sm">
                                <a
                                    href="https://github.com/GoJam11/ChatFlex/issues"
                                    target="_blank"
                                    class="no-underline"
                                >
                                    {{ t('about.reportIssue') }}
                                </a>
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <!-- 免责声明 -->
        <div class="flex justify-center">
            <Dialog v-model:open="disclaimerOpen">
                <DialogTrigger as-child>
                    <Button variant="link" class="text-muted-foreground text-sm">
                        {{ t('about.disclaimer') }}
                    </Button>
                </DialogTrigger>
                <DialogScrollContent class="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle>{{ t('about.disclaimer') }}</DialogTitle>
                    </DialogHeader>
                    <div class="text-sm text-muted-foreground space-y-3">
                        <div>
                            <p class="font-medium text-foreground">
                                {{ t('about.terms.serviceNature.title') }}
                            </p>
                            <p>{{ t('about.terms.serviceNature.content') }}</p>
                        </div>
                        <div>
                            <p class="font-medium text-foreground">
                                {{ t('about.terms.contentResponsibility.title') }}
                            </p>
                            <p>{{ t('about.terms.contentResponsibility.content') }}</p>
                        </div>
                        <div>
                            <p class="font-medium text-foreground">
                                {{ t('about.terms.usageRisk.title') }}
                            </p>
                            <p>{{ t('about.terms.usageRisk.content') }}</p>
                        </div>
                        <div>
                            <p class="font-medium text-foreground">
                                {{ t('about.terms.dataSecurity.title') }}
                            </p>
                            <p>{{ t('about.terms.dataSecurity.content') }}</p>
                        </div>
                        <div>
                            <p class="font-medium text-foreground">
                                {{ t('about.terms.complianceUsage.title') }}
                            </p>
                            <p>{{ t('about.terms.complianceUsage.content') }}</p>
                        </div>
                        <div>
                            <p class="font-medium text-foreground">
                                {{ t('about.terms.serviceChanges.title') }}
                            </p>
                            <p>{{ t('about.terms.serviceChanges.content') }}</p>
                        </div>
                    </div>
                </DialogScrollContent>
            </Dialog>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogHeader,
    DialogScrollContent,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const disclaimerOpen = ref(false);
</script>

<style scoped>
.section-title {
    font-weight: bold;
    color: var(--color-text);
    margin-bottom: 0.5rem;
}
</style>
