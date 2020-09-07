import guiFeature, { mainDashboardEnv } from './gui.feature';
import { buildEnv } from './build.feature';
import { socketServerInitializer } from '@wixc3/engine-core/src';
import React from 'react';
import { render } from 'react-dom';
import { App } from '../../scripts/src/engine-dashboard/components/app';

guiFeature.setup(mainDashboardEnv, ({ run }, { COM: { startEnvironment } }) => {
    run(async () => {
        await startEnvironment(buildEnv, socketServerInitializer());
        const reactContainer = document.createElement('div');
        document.body.appendChild(reactContainer);

        render(<App />, reactContainer);
    });
});
