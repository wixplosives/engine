import React from 'react';
import { createRoot } from 'react-dom/client';
import guiFeature, { mainDashboardEnv } from './gui.feature.js';
import { devServerEnv } from './dev-server.feature.js';
import { socketClientInitializer } from '@wixc3/engine-core';
import { App } from '@wixc3/engine-dashboard';

guiFeature.setup(mainDashboardEnv, ({ run }, { COM: { communication } }) => {
    run(async () => {
        await socketClientInitializer({ communication, env: devServerEnv });
        const appContainer = document.createElement('div');
        document.body.appendChild(appContainer);

        createRoot(appContainer).render(<App />);
    });
});
