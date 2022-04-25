import { Feature, Environment } from '@wixc3/engine-core';

// this is the environment in which this feature will set itself up
export const myEnv = new Environment('my-env', 'node', 'single');

export interface IEchoService {
    echo(name: string): string;
}

// our first feature
export default new Feature({
    id: 'helloWorldFeature',
    api: {},
});
