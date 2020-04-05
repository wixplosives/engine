import CodeEditor, { PROCESSING } from './code-editor.feature';
import { CodeService } from './code-service';

CodeEditor.setup(PROCESSING, ({ run, remoteCodeService, errorService }, {}) => {
    const codeService = new CodeService();

    run(async () => {
        await remoteCodeService.listen(async () => {
            codeService.setContent(await remoteCodeService.getContent());
            if (codeService.getContent().includes('s')) {
                await errorService.reportError('`s` is not allowed!');
            }
        });
    });

    return {
        codeService,
    };
});
