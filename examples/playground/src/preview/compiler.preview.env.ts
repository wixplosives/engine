import Preview, { PREVIEW } from './compiler.feature.js';

Preview.setup(PREVIEW, ({ run, compileService }, { playgroundCodeEditor: { remoteCodeService } }) => {
    run(async () => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        await remoteCodeService.listen(async () => {
            document.body.innerHTML = (await compileService.compile()).code;
        });
    });
});
