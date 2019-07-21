import CodeEditor, { MAIN, PROCESSING } from './code-editor.feature';
import { CodeService } from './code-service';
import { ErrorService } from './error-service';
import { classes } from './style.st.css';

document.body.classList.add(classes.root);

CodeEditor.setup(MAIN, ({ sidebarSlot, run }, { COM }) => {
    const codeService = new CodeService();
    const errorService = new ErrorService();
    COM.spawn(PROCESSING); // returns processingID

    sidebarSlot.register({
        button: {
            text: 'Errors',
            icon: 'icon.png'
        },
        panel() {
            const panel = document.createElement('pre');
            const update = () => {
                panel.innerHTML = errorService.getErrors().join('\n');
            };
            errorService.listen(update);
            update();
            return panel;
        }
    });

    run(() => {
        const { codeInput, sidebar } = render();

        codeInput.value = codeService.getContent();

        codeInput.addEventListener('change', () => codeService.setContent(codeInput.value));

        for (const slot of sidebarSlot) {
            const btn = document.createElement('button');
            btn.textContent = slot.button.text;
            sidebar.appendChild(btn);
            sidebar.appendChild(slot.panel());
        }
    });

    return {
        errorService,
        codeService,
        remoteCodeService: codeService
    };
});

function render() {
    const mainArea = document.createElement('main-area');
    const codeInput = document.createElement('textarea');
    const sidebar = document.createElement('sidebar');
    sidebar.style.background = 'rgba(0,0,0,0.1)';
    sidebar.style.display = 'block';
    mainArea.innerHTML = '<h1>Type text here</h1>';
    mainArea.appendChild(codeInput);
    document.body.appendChild(sidebar);
    document.body.appendChild(mainArea);
    return { codeInput, sidebar, mainArea };
}
