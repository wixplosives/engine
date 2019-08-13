import { mainEnv } from '../feature/contextual-with-worker-default.feature';
import ExampleFeature from './server-env-contextual.feature';

ExampleFeature.setup(mainEnv, ({ run }, { multiEnv: { serverService } }) => {
    run(async () => {
        document.body.innerText = await serverService.echo();
    });
    return null;
});
