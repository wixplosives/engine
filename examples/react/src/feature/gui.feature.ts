import { EngineFeature, Slot } from '@wixc3/engine-core';
import type React from 'react';
import reactRendererFeature, { MainEnv } from './react-renderer.feature';

export default class GuiFeature extends EngineFeature<'guiFeature'> {
    id = 'guiFeature' as const;
    api = {
        extentionSlot: Slot.withType<React.ReactElement>().defineEntity(MainEnv),
    };
    dependencies = [reactRendererFeature];
}
