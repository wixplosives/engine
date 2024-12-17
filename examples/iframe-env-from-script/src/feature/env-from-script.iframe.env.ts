import IframeEnvFromScript, { iframeEnv } from './env-from-script.feature.js';

IframeEnvFromScript.setup(iframeEnv, ({}, {}) => {
    const p = document.createElement('p');
    p.appendChild(document.createTextNode('iframe initialized'));
    document.body.appendChild(p);

    return {
        echoService: {
            echo() {
                const p = document.createElement('p');
                p.appendChild(document.createTextNode('echo'));
                document.body.appendChild(p);
            },
        },
    };
});
