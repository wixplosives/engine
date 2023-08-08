import { iframeInitializer } from '@wixc3/engine-core';
import { mainEnv, iframeEnv } from './echo.feature.js';
import fixture from './configured-iframe.feature.js';

fixture.setup(mainEnv, ({ run }, { COM: { communication }, echoFeature: { echoService } }) => {
    const myFrame = document.createElement('iframe');
    myFrame.id = 'iframe';
    document.body.append(myFrame);
    const fConfigs = [
        { hostname: '127.0.0.1', param: 'p0' },
        { hostname: '127.0.0.1', param: 'p1' },
        { hostname: 'localhost', param: 'p2' },
    ];

    for (let i = 0; i < fConfigs.length; i++) {
        const fConfig = fConfigs[i]!;
        const button = document.createElement('button');
        const url = new URL(window.location.href);
        url.pathname = 'iframe.html';
        url.hostname = fConfig.hostname;
        url.search = url.search + '&test=' + fConfig.param;
        button.appendChild(document.createTextNode(url.toString()));
        button.className = `init-iframe-button-${i}`;
        button.onclick = async () => {
            const { id } = await iframeInitializer({
                communication,
                env: iframeEnv,
                iframeElement: myFrame,
                src: url.toString(),
            });
            void echoService.get({ id }).echo(id);
        };
        document.body.append(button);
    }
    run(async () => {
        const { id } = await iframeInitializer({
            communication,
            env: iframeEnv,
            iframeElement: myFrame,
        });
        await echoService.get({ id }).echo(id);
    });
});
