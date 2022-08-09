import { iframeEnv } from './echo.feature';
import echoFeature from './echo.feature';

echoFeature.setup(iframeEnv, ({}) => {
    document.body.appendChild(document.createTextNode('echo service set up'));
    document.body.appendChild(document.createElement('br'));

    return {
        echoService: {
            echo: (message) => {
                document.body.appendChild(document.createTextNode(message));
                document.body.appendChild(document.createTextNode(window.location.href));
            },
        },
    };
});
