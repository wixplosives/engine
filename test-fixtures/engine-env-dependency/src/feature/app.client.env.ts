import { client } from './app.feature.js';
import MyFeature from './app.feature.js';

MyFeature.setup(client, ({ wrapRender }) => {
    return {
        render(content) {
            window.document.body.innerHTML = [...wrapRender].reduce((acc, wrapper) => wrapper(acc), content);
        },
    };
});
