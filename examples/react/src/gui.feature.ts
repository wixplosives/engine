import { Feature, Slot } from '@wixc3/engine-core';
import type React from 'react';
import reactRendererFeature, { MainEnv } from './react-renderer.feature';

export default new Feature({
    id: 'guiFeature',
    dependencies: [reactRendererFeature.asEntity],
    api: {
        extentionSlot: Slot.withType<React.FunctionComponent>().defineEntity(MainEnv),
    },
});
