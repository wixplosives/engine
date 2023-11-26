/**
 * @type {import('@wixc3/engine-scripts').EngineConfig}
 */
module.exports = {
    featureDiscoveryRoot: 'dist',
    buildPlugins: ({ webConfig, nodeConfig }) => {
        nodeConfig.packages = 'external';
        return {
            webConfig,
            nodeConfig,
        };
    },
};
