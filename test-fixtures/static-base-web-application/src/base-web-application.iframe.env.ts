import BaseAppFeature, { iframe } from './base-web-application.feature.js';

BaseAppFeature.setup(iframe, ({ iframeSlot, run }) => {
    iframeSlot.register('hello');

    run(() => {
        const div = document.createElement('div');
        div.id = 'main-container';
        div.innerText = [...iframeSlot].join(' ');
        document.body.appendChild(div);
    });
});
