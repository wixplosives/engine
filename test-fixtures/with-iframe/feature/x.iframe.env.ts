import { iframeEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(iframeEnv, ({}) => {
    return {
        echoService: {
            echo: (message) => {
                document.body.appendChild(document.createTextNode(message));
            },
        },
    };
});
