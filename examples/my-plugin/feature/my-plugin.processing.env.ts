import { PROCESSING } from '@example/playground/src/code-editor/code-editor.feature';
import MyPlugin from './my-plugin.feature';

MyPlugin.setup(PROCESSING, ({}, { preview: { complierExtension } }) => {
    complierExtension.register({
        matcher: (content) => content.length % 2 === 0,
        compile: (content) => content + content[content.length - 1],
    });
});
