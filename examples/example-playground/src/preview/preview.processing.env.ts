import { PROCESSING } from '../code-editor/code-editor.feature';
import { BaseCompiler } from './BaseCompiler';
import Preview from './preview.feature';

Preview.setup(PROCESSING, ({ complierExtension }, { playgroundCodeEditor: { remoteCodeService } }) => {
    complierExtension.register({
        compile(content: string) {
            return content
                .split('')
                .reverse()
                .join('');
        },
        matcher(_content: string) {
            return _content.indexOf('reverse') !== -1;
        }
    });

    return {
        compileService: new BaseCompiler(remoteCodeService, () => Array.from(complierExtension))
    };
});
