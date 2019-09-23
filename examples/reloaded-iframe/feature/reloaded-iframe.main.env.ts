import { contentId, echoBtnId, refreshBtnId } from '../src/consts';
import ReloadedIframe, { iframeEnv, mainEnv } from './reloaded-iframe.feature';

ReloadedIframe.setup(mainEnv, ({ run, echoService }, { COM }) => {
    const div = document.createElement('div');
    const echoButton = document.createElement('button');
    const refreshIframeButton = document.createElement('button');

    div.id = contentId;

    echoButton.id = echoBtnId;

    refreshIframeButton.id = refreshBtnId;

    div.innerText = `document was called 0 times`;
    echoButton.innerText = 'echo';
    refreshIframeButton.innerText = 'refresh';

    document.body.append(div, echoButton, refreshIframeButton);
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    run(async () => {
        const envToken = await COM.manage(iframeEnv, iframe);

        echoButton.onclick = async () => {
            await echoService.get(envToken).echo();
        };
        refreshIframeButton.onclick = () => {
            iframe.contentWindow!.location.reload();
        };

        // tslint:disable-next-line: no-floating-promises
        echoService.get(envToken).onEcho(times => {
            div.innerText = `document was called ${times} times`;
        });
    });
    return null;
});
