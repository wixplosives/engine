import guiFeature, { mainDashboardEnv } from './gui.feature';
import { buildEnv } from './build.feature';
import { socketServerInitializer } from '@wixc3/engine-core/src';

guiFeature.setup(mainDashboardEnv, ({ run }, { COM: { startEnvironment }, buildFeature: { application } }) => {
    run(async () => {
        await startEnvironment(buildEnv, socketServerInitializer());
        const div = document.createElement('div');
        div.textContent = await application.test();
        document.body.appendChild(div);
    });
});
