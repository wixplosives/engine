import { Feature } from '@wixc3/engine-core';
import Compiler from '@example/playground/src/preview/compiler.feature';

export default new Feature({
    id: 'myPlugin',
    dependencies: [Compiler],
    api: {},
});
