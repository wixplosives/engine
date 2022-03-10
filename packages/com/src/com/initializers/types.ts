import type { Environment } from '@wixc3/engine-core';
import type { Communication } from '../communication';

export interface InitializerOptions {
    communication: Communication;
    env: Environment;
}
