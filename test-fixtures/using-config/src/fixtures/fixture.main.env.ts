import MyFeature from './fixture.feature.js';
import { main } from '../feature/use-configs.feature.js';

MyFeature.setup(main, ({ run }) => {
    run(() => {
        document.body.innerText += `alternative`;
    });
});
