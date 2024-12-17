import { installRunOptionsInitMessageHandler } from '@wixc3/engine-core';
import IframeEnvFromScript, { mainEnv } from './env-from-script.feature.js';

IframeEnvFromScript.setup(mainEnv, ({ run, echoService }, { COM }) => {
    const echoButton = document.createElement('button');
    echoButton.id = 'echo';
    echoButton.innerText = 'echo';
    document.body.append(echoButton);

    run(async () => {
        const instanceId = 'iframe-env/0';
        const iframe = document.createElement('iframe');
        iframe.srcdoc = `<html>
        <body>
        <script defer="" type="module" src="http://localhost:3000/iframe.web.js" data-engine-run-options="fetch-options-from-parent=true"></script>
        </body>
        </html>`;
        document.body.appendChild(iframe);
        const contentWindow = iframe.contentWindow!;
        const cleanUp = installRunOptionsInitMessageHandler(contentWindow, () => {
            cleanUp();
            const parentParams = new URLSearchParams(window.location.search);
            return new URLSearchParams({
                feature: parentParams.get('feature')!,
                'iframe-instance-id': instanceId,
            });
        });

        const com = COM.communication;
        com.registerEnv(instanceId, contentWindow);
        await com.envReady(instanceId);

        echoButton.onclick = async () => {
            await echoService.get({ id: instanceId }).echo();
        };
    });
});
