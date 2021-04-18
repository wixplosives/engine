import { COM, Environment, Feature, Service, Slot } from '@wixc3/engine-core';

import type { CodeService } from './code-service';
import type { ErrorService } from './error-service';

export const MAIN = new Environment('main', 'window', 'single');
export const PROCESSING = new Environment('processing', 'worker', 'single');

export interface SidebarItem {
    button: {
        text: string;
        icon: string;
    };
    panel: () => HTMLElement;
}

export default new Feature({
    id: 'playgroundCodeEditor',
    dependencies: [COM],
    api: {
        sidebarSlot: Slot.withType<SidebarItem>().defineEntity(MAIN),
        codeService: Service.withType<CodeService>().defineEntity([MAIN, PROCESSING]),
        remoteCodeService: Service.withType<CodeService>()
            .defineEntity(MAIN)
            .allowRemoteAccess({
                listen: {
                    listener: true,
                },
            }),
        errorService: Service.withType<ErrorService>().defineEntity(MAIN).allowRemoteAccess(),
    },
});
