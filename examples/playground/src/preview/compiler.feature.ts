import { COM, Environment, Feature, Service, Slot } from '@wixc3/engine-core';
import CodeEditor, { PROCESSING } from '../code-editor/code-editor.feature';
import { BaseCompiler, CompilerExtension } from './BaseCompiler';
import { iframeInitializer } from '@wixc3/engine-core';

export const PREVIEW = new Environment('preview', 'iframe', 'single', iframeInitializer());

const complierExtension = Slot.withType<CompilerExtension>().defineEntity(PROCESSING);

const compileService = Service.withType<BaseCompiler>()
    .defineEntity(PROCESSING)
    .allowRemoteAccess();

export default new Feature({
    id: 'preview',
    dependencies: [COM, CodeEditor],
    api: {
        complierExtension,
        compileService
    }
});
