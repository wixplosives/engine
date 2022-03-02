import Preview, { PREVIEW } from './compiler.feature';
import { iframeInitializer } from '@wixc3/engine-core';
import { MAIN } from '../code-editor/code-editor.feature';

Preview.setup(MAIN, ({}, { playgroundCodeEditor: { sidebarSlot }, COM }) => {
    sidebarSlot.register({
        button: {
            text: 'Preview',
            icon: 'preview-icon.png',
        },
        panel() {
            const panel = document.createElement('pre');
            const iframe = document.createElement('iframe');
            panel.appendChild(iframe);

            iframe.onload = () =>
                iframeInitializer({ communication: COM.communication, env: PREVIEW, iframeElement: iframe });

            return panel;
        },
    });
});
