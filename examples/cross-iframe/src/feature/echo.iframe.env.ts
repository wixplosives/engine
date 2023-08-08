import { iframeEnv } from './echo.feature.js';
import echoFeature from './echo.feature.js';

echoFeature.setup(iframeEnv, ({}) => {
    return {
        echoService: {
            echo: (message) => {
                document.body.appendChild(document.createTextNode(message));
            },
        },
    };
});
