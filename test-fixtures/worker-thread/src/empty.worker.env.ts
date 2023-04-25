import emptyFeature, { workerEnv } from './empty.feature';

emptyFeature.setup(workerEnv, () => {
    console.log('worker running...');
});
