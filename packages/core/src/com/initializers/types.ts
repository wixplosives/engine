import type { AnyEnvironment } from '../../entities';
import type { Communication } from '../communication';

export interface InitializerOptions {
    communication: Communication;
    env: AnyEnvironment;
}
