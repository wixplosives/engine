import sampleFeature from './print-dependencies.feature';
import { mainEnv } from '../feature/x.feature';
import { GlobalSchemaRegistry } from '@wixc3/schema-registry';

sampleFeature.setup(mainEnv, ({ run }) => {
    run(() => {
        const registry = Array.from(GlobalSchemaRegistry.entries());
        const div = document.createElement('div');
        div.innerText = JSON.stringify(registry);
        div.id = 'registry';
        document.body.appendChild(div);
    });
    return null;
});
