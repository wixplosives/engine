import { iframeEnv } from './echo.feature';
import echoFeature from './echo.feature';

echoFeature.setup(iframeEnv, ({}) => {
    return {
        echoService: {
            echo: (message) => {
                document.body.appendChild(document.createTextNode(message));
                document.body.appendChild(document.createElement('br'));
                document.body.appendChild(document.createTextNode(window.location.href));
            },
        },
    };
});
