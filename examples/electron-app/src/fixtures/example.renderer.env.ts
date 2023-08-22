import { renderer } from '../feature/electron-app.feature.js';
import TestFeature from './example.feature.js';

TestFeature.setup(renderer, ({ run }, { electronExample: { echoService } }) => {
    run(async () => {
        /**
         * invoking echo method from server
         */
        const echo = await echoService.echo();
        const div = document.createElement('div');
        document.body.appendChild(div);
        div.innerHTML = `<div id='testdiv'>${JSON.stringify(echo, null, 4).replace(/\r\n/, '<br />')}</div>`;

        /**
         * subscribing to an event from the server
         */
        await echoService.subscribe((t) => {
            div.innerText = `received event ${t}`;
        });

        /**
         * invoking listeners after a second
         */
        setTimeout(() => {
            // eslint-disable-next-line no-console
            echoService.invokeListeners().catch(console.error);
        }, 1_000);
    });
});
