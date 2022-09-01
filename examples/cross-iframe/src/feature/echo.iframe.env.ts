import { iframeEnv } from './echo.feature';
import echoFeature from './echo.feature';

echoFeature.setup(iframeEnv, ({}) => {
    return {
        echoService: {
            echo: (message) => {
                document.body.appendChild(document.createTextNode(message));
            },
        },
    };
});
