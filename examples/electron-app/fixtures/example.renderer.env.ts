import { renderer } from '../feature/electron-app.feature';
import TestFeature from './example.feature';

/**
 * setting up the local main environment file
 */
TestFeature.setup(renderer, ({ run }, { electronExample: { echoService } }) => {
    run(async () => {
        /**
         * invoking echo method from server
         */
        const echo = await echoService.echo();

        document.body.innerHTML = `<div id='testdiv'>${JSON.stringify(echo, null, 4).replace(/\r\n/, '<br />')}</div>`;

        /**
         * subscribing to an event from the server
         */
        await echoService.subscribe((t) => {
            document.body.innerText = `received event ${t}`;
        });

        /**
         * invoking listeners after a minute
         */
        setTimeout(() => {
            echoService.invokeListeners().catch(console.error);
        }, 1_000);
    });
});
