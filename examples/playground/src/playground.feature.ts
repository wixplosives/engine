import { Feature } from '@wixc3/engine-core';
import Code from './code-editor/code-editor.feature';
import EndWithCompiler from './end-with/end-with.feature';
import Preview from './preview/compiler.feature';

export default class EnginePlayGroundExample extends Feature<'enginePlayGroundExample'> {
    id = 'enginePlayGroundExample' as const;
    api = {};
    dependencies = [Code, Preview, EndWithCompiler];
}
