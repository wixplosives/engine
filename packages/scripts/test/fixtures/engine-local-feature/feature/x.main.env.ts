import { mainEnv, serverEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(mainEnv, ({ run, serverService }, { COM: { connect } }) => {
    connect(serverEnv);
    run(async () => {
        document.body.textContent = await serverService.echo();
    });
    return null;
});
