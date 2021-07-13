import type { Environment } from '../../entities';
import type { Communication } from '../communication';

export interface InitializerOptions {
    communication: Communication;
    env: Environment;
}
