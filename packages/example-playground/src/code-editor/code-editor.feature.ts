import { COM, Environment, Feature, Service, SingleEndPointAsyncEnvironment, Slot } from '@wixc3/engine-core';

import { CodeService } from './code-service';
import { ErrorService } from './error-service';

export const MAIN = new Environment('main');
export const PROCESSING = new SingleEndPointAsyncEnvironment('processing', 'worker', MAIN);

const sidebarSlot = Slot.withType<{
    button: {
        text: string;
        icon: string;
    };
    panel: () => HTMLElement;
}>().defineEntity(MAIN);

const codeService = Service.withType<CodeService>().defineEntity([MAIN, PROCESSING]);
const remoteCodeService = Service.withType<CodeService>()
    .defineEntity(MAIN)
    .allowRemoteAccess();

const errorService = Service.withType<ErrorService>()
    .defineEntity(MAIN)
    .allowRemoteAccess();

export default new Feature({
    id: 'playgroundCodeEditor',
    dependencies: [COM],
    api: {
        sidebarSlot,
        codeService,
        remoteCodeService,
        errorService
    }
});
