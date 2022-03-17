import React from 'react';
import { render } from 'react-dom';
import guiFeature, { mainDashboardEnv } from './gui.feature';
import { devServerEnv } from './dev-server.feature';
import { socketClientInitializer } from '@wixc3/engine-com';
import { App } from '@wixc3/engine-dashboard';

guiFeature.setup(mainDashboardEnv, ({ run }, { COM: { communication } }) => {
    run(async () => {
        await socketClientInitializer({ communication, env: devServerEnv });
        const appContainer = document.createElement('div');
        document.body.appendChild(appContainer);

        render(<App />, appContainer);
    });
});
