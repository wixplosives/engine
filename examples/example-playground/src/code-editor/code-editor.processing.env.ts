import CodeEditor, { PROCESSING } from './code-editor.feature';
import { CodeService } from './code-service';

CodeEditor.setup(PROCESSING, ({ run, remoteCodeService, errorService }, {}) => {
    const codeService = new CodeService();

    run(() => {
        remoteCodeService.listen(async () => {
            codeService.setContent(await remoteCodeService.getContent());
            findErrors();
        });

        function findErrors() {
            if (codeService.getContent().indexOf('s') !== -1) {
                errorService.reportError('`s` is not allowed!');
            }
        }
    });

    return {
        codeService
    };
});
