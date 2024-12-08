/**
 * @type {import('@wixc3/engine-cli').EngineConfig}
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
