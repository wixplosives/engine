import depFeature from './dep.feature';
import { processingEnv } from './multi-env.feature';
console.log('dep evaluated');

depFeature.setup(processingEnv, () => {
    console.log('dep setup');
});
