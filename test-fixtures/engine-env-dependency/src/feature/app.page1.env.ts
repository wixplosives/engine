import { page1 } from './app.feature.js';
import MyFeature from './app.feature.js';

MyFeature.setup(page1, ({ render, run }) => {
    run(() => {
        render(page1.env);
    });
});
