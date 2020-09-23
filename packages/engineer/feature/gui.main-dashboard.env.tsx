import guiFeature, { mainDashboardEnv } from './gui.feature';
import { devServerEnv } from './dev-server.feature';
import { socketServerInitializer } from '@wixc3/engine-core';
import React from 'react';
import { render } from 'react-dom';
import { App } from '../engine-dashboard/components/app';

guiFeature.setup(mainDashboardEnv, ({ run }, { COM: { startEnvironment } }) => {
    run(async () => {
        await startEnvironment(devServerEnv, socketServerInitializer());
        const appContainer = document.createElement('div');
        document.body.appendChild(appContainer);

        render(<App />, appContainer);
    });
});
