import Preview, { PREVIEW } from './compiler.feature';
import { iframeInitializer } from '@wixc3/engine-core';

Preview.setup('main', ({}, { playgroundCodeEditor: { sidebarSlot }, COM }) => {
    sidebarSlot.register({
        button: {
            text: 'Preview',
            icon: 'preview-icon.png'
        },
        panel() {
            const panel = document.createElement('pre');
            const iframe = document.createElement('iframe');
            panel.appendChild(iframe);

            PREVIEW.initializer = iframeInitializer({
                hostProvider: () => iframe
            });

            iframe.onload = () => COM.startEnvironment(PREVIEW);
            return panel;
        }
    });

    return null;
});
