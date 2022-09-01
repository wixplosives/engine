import { iframeInitializer } from '@wixc3/engine-core';
import { mainEnv, iframeEnv } from './echo.feature';
import fixture from './configured-iframe.feature';

fixture.setup(mainEnv, ({ run }, { COM: { communication }, echoFeature: { echoService } }) => {
    const myFrame = document.createElement('iframe');
    myFrame.id = 'iframe';
    document.body.append(myFrame);
    const fConfigs = [
        { hostname: '127.0.0.1', param: 'abc' },
        { hostname: '127.0.0.1', param: '123' },
        { hostname: 'localhost', param: 'bebebe' },
        { hostname: '127.0.0.1', param: 'tutut' },
    ];

    for (const fConfig of fConfigs) {
        const button = document.createElement('button');
        const url = new URL(window.location.href);
        url.pathname = 'iframe.html';
        url.hostname = fConfig.hostname;
        url.search = url.search + '&test=' + fConfig.param;
        button.appendChild(document.createTextNode(url.toString()));
        button.className = 'init-iframe-button';
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
