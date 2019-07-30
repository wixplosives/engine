import { EQUAL } from 'typescript-type-utils';
import { EnvType, Running, Entity } from '../src';

export type FromString = EQUAL<EnvType<'main'>, 'main'>;
export type FromEnvArray = EQUAL<EnvType<[{ env: 'main' }]>, 'main'>;
export type FromEnv = EQUAL<EnvType<{ env: 'main' }>, 'main'>;
export type FromEnvArrayMultiple = EQUAL<EnvType<[{ env: 'main' }, { env: 'main1' }]>, 'main' | 'main1'>;
export type FromEnvEmptyArray = EQUAL<EnvType<[]>, any>;

export type RunningEmpty = EQUAL<Running<{ id: ''; api: {} }, 'main'>, {}>;
export type RunningProvidesApiInputTypes = EQUAL<
    Running<{ id: ''; api: { x: Entity<string, string, 'main', 'main', 'input', false> } }, 'main'>,
    { x: string }
>;
export type RunningProvidesApiOutputTypes = EQUAL<
    Running<{ id: ''; api: { x: Entity<string, string, 'main', 'main', 'output', false> } }, 'main'>,
    { x: string }
>;
