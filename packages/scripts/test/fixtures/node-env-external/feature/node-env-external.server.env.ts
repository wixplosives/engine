import { serverEnv } from '@fixture/engine-node/feature/x.feature';
import myFeature from './node-env-external.feature';

myFeature.setup(serverEnv, ({}, { XTestFeature: { aSlot } }) => {
    aSlot.register('value');
});
