import { EQUAL } from 'typescript-type-utils';
import { EnvType, Running, Entity, Environment } from '@wixc3/engine-core';

type MAIN1 = Environment<'main', 'node', 'single'>;
type K = EnvType<[]>;
export type FromEnvArray = EQUAL<EnvType<[MAIN1]>, 'main'>;
export type FromEnv = EQUAL<EnvType<MAIN1>, 'main'>;
export type FromEnvArrayMultiple = EQUAL<EnvType<[MAIN1, Environment<'main1', 'node', 'single'>]>, 'main' | 'main1'>;
export type FromEnvEmptyArray = EQUAL<EnvType<[]>, never>;

export type RunningEmpty = EQUAL<Running<{ id: ''; api: {} }, 'main'>, {}>;
export type RunningProvidesApiInputTypes = EQUAL<
    Running<{ id: ''; api: { x: Entity<string, string, MAIN1, MAIN1, 'input', false> } }, 'main'>,
    { x: string }
>;
export type RunningProvidesApiOutputTypes = EQUAL<
    Running<{ id: ''; api: { x: Entity<string, string, MAIN1, MAIN1, 'output', false> } }, 'main'>,
    { x: string }
>;
