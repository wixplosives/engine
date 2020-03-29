import { main } from '../feature/electron-app.feature';
import TestFeature from './example.feature';

/**
 * setting up the local main environment file
 */
TestFeature.setup(main, ({ run }, { electronExample: { echoService } }) => {
    run(async () => {
        const echo = await echoService.echo();

        document.body.innerHTML = `<div id='testdiv'>${JSON.stringify(echo, null, 4).replace(/\r\n/, '<br />')}</div>`;

        await echoService.listenToTimer(t => {
            document.body.innerText = `timer ` + t;
        });
    });

    return null;
});
