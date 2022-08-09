import { iframeInitializer } from '@wixc3/engine-core';
import { mainEnv, iframeEnv } from './echo.feature';
import fixture from './configured-iframe.feature';

fixture.setup(mainEnv, ({ run, config }, { COM: { communication }, echoFeature: { echoService } }) => {
    const myFrame = document.createElement('iframe');
    myFrame.id = 'iframe';
    document.body.append(myFrame);
    const fConfigs = [
        { managed: true, host: '127.0.0.1:3000', param: 'abc' },
        { managed: true, host: '127.0.0.1:3000', param: '123' },
        { managed: true, host: 'localhost:3000', param: 'bebebe' },
        { managed: true, host: '127.0.0.1:3000', param: 'tutut' },
    ];

    for (const fConfig of fConfigs) {
        const button = document.createElement('button');
        const url = new URL(window.location.href);
        url.pathname = 'iframe.html';
        url.host = fConfig.host;
        url.search = url.search + '&test=' + fConfig.param;
        button.appendChild(document.createTextNode(url.toString()));
        button.onclick = async () => {
            const { id } = await iframeInitializer({
                communication,
                env: iframeEnv,
                iframeElement: myFrame,
                managed: config.managed,
                src: url.toString(),
            });
            void echoService
                .get({ id })
                .echo(`${config.managed ? 'managed ' : ''}${fConfig.host ?? ''} id ${id} echo ${config.message ?? ''}`);
        };
        document.body.append(button);
    }
    run(async () => {
        const { id } = await iframeInitializer({
            communication,
            env: iframeEnv,
            iframeElement: myFrame,
            managed: config.managed,
            origin: config.origin,
        });
        await echoService
            .get({ id })
            .echo(`${config.managed ? 'managed ' : ''}${config.origin ?? ''} id ${id} echo ${config.message ?? ''}`);
    });
});
