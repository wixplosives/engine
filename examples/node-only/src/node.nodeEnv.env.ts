import nodeFeature, { NodeEnv } from './node.feature';

nodeFeature.setup(NodeEnv, () => {
    console.log('I am a node env only application');
});
