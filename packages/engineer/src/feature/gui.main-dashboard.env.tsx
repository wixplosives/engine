import guiFeature, { mainDashboardEnv } from './gui.feature';
import { devServerEnv } from './dev-server.feature';
import { socketServerInitializer } from '@wixc3/engine-core';
import React from 'react';
import { render } from 'react-dom';
import { App } from '@wixc3/engine-dashboard';

guiFeature.setup(mainDashboardEnv, ({ run }, { COM: { communication } }) => {
    run(async () => {
        await socketServerInitializer(communication, devServerEnv);
        const appContainer = document.createElement('div');
        document.body.appendChild(appContainer);

        render(<App />, appContainer);
    });
});
