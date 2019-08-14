import Preview, { PREVIEW } from './compiler.feature';

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

            iframe.onload = () => COM.spawn(PREVIEW, iframe);
            return panel;
        }
    });

    return null;
});
