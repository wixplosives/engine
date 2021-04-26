import { MainEnv } from './react-renderer.feature';
import somepluginFeature from './someplugin.feature';
import React from 'react';
import { Comp } from './someComp';

somepluginFeature.setup(MainEnv, ({}, { guiFeature: { extentionSlot } }) => {
    extentionSlot.register(<li key={somepluginFeature.id}>thiss registered</li>);
    extentionSlot.register(<Comp key="cosmp" />);
});

if (module.hot) {
    module.hot.accept();
}
