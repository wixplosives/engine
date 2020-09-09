import guiFeature, { mainDashboardEnv } from './gui.feature';
import { devServerEnv } from './dev-server.feature';
import { socketServerInitializer } from '@wixc3/engine-core/src';
import React from 'react';
import { render } from 'react-dom';
import { App } from '../engine-dashboard/components/app';

guiFeature.setup(mainDashboardEnv, ({ run }, { COM: { startEnvironment } }) => {
    run(async () => {
        await startEnvironment(devServerEnv, socketServerInitializer());
        const reactContainer = document.createElement('div');
        document.body.appendChild(reactContainer);

        render(<App />, reactContainer);
    });
});
