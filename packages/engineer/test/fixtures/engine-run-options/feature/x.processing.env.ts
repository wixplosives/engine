import sampleFeature, { PROC } from './x.feature';
import { MyInterfaceClass } from './interface';
import { RUN_OPTIONS } from '@wixc3/engine-core';

sampleFeature.setup(PROC, ({ [RUN_OPTIONS]: runOptions }) => {
    const options = {
        foo: runOptions.get('foo'),
    };
    return {
        passedOptions: new MyInterfaceClass(options),
    };
});
