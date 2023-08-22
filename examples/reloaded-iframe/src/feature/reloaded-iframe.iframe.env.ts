import ReloadedIframe, { iframeEnv } from './reloaded-iframe.feature.js';

ReloadedIframe.setup(iframeEnv, ({}, {}) => {
    let times = 0;
    const handlers: Array<(times: number) => void> = [];
    return {
        echoService: {
            echo() {
                times++;
                for (const handler of handlers) {
                    handler(times);
                }
            },
            onEcho(handler) {
                handlers.push(handler);
            },
        },
    };
});
