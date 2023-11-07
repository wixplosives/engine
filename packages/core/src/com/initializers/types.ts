import type { AnyEnvironment } from '../../entities/index.js';
import type { Communication } from '../communication.js';

export interface InitializerOptions {
    communication: Communication;
    env: AnyEnvironment;
}
