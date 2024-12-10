/** @type {import('@wixc3/engine-cli').EngineConfig} */
export default {
    featureDiscoveryRoot: 'dist',
    buildPlugins: ({ webConfig, nodeConfig }) => {
        nodeConfig.packages = 'external';
        return {
            webConfig,
            nodeConfig,
        };
    },
};
