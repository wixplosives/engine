import { iframeEnv } from './x.feature.js';
import sampleFeature from './x.feature.js';

sampleFeature.setup(iframeEnv, ({}) => {
    return {
        echoService: {
            echo: (message) => {
                document.body.appendChild(document.createTextNode(message));
            },
        },
    };
});
