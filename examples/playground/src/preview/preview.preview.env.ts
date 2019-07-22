import Preview from './preview.feature';

Preview.setup('preview', ({ run, compileService }, { playgroundCodeEditor: { remoteCodeService } }) => {
    run(() => {
        remoteCodeService.listen(async () => {
            document.body.innerHTML = (await compileService.compile()).code;
        });
    });
    return null;
});
