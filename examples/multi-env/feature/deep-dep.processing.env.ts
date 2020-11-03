import deepdepFeature from './deep-dep.feature';
import { processingEnv } from './multi-env.feature';
console.log('deepdep evaluated');

deepdepFeature.setup(processingEnv, () => {
    console.log('deepdep setup');
});
