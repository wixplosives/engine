import { createMultipleComponentSimulations } from "@wixc3/simulation-core";
import { Dashboard } from "../../packages/scripts/src/engine-dashboard/components/dashboard2";

export default createMultipleComponentSimulations([{
        name: "New Simulation",
        readOnly: false,
        props: {
        features: {
            value: {
        'file-server': {
            configurations: ['file-server/run'],
            hasServerEnvironments: true,
            featureName: 'file-server'
        },
        'file-server/example': {
            configurations: ['file-server/run'],
            hasServerEnvironments: true,
            featureName: 'file-server/example'
        },
        'multi-env': { configurations: ['multi-env/run'], hasServerEnvironments: false, featureName: 'multi-env' },
        'multi-env/test-node': {
            configurations: ['multi-env/run'],
            hasServerEnvironments: true,
            featureName: 'multi-env/test-node'
        },
        'multi-env/test-worker': {
            configurations: ['multi-env/run'],
            hasServerEnvironments: false,
            featureName: 'multi-env/test-worker'
        },
        playground: { configurations: ['playground/run'], hasServerEnvironments: false, featureName: 'playground' },
        'reloaded-iframe': { configurations: [], hasServerEnvironments: false, featureName: 'reloaded-iframe' },
        'engine-core/communication': {
            configurations: [],
            hasServerEnvironments: false,
            featureName: 'engine-core/communication'
        },
        '3rd-party': { configurations: [], hasServerEnvironments: false, featureName: '3rd-party' },
        'contextual/some-feature': {
            configurations: [],
            hasServerEnvironments: false,
            featureName: 'contextual/some-feature'
        },
        'contextual/server-env': {
            configurations: [],
            hasServerEnvironments: true,
            featureName: 'contextual/server-env'
        },
        'engine-single/x': {
            configurations: ['engine-single/x'],
            hasServerEnvironments: false,
            featureName: 'engine-single/x'
        },
        'engine-multi/app': {
            configurations: ['engine-multi/fixture1', 'engine-multi/variant1', 'engine-multi/variant2'],
            hasServerEnvironments: false,
            featureName: 'engine-multi/app'
        },
        'engine-multi/variant': {
            configurations: ['engine-multi/fixture1', 'engine-multi/variant1', 'engine-multi/variant2'],
            hasServerEnvironments: false,
            featureName: 'engine-multi/variant'
        },
        'engine-node/x': { configurations: [], hasServerEnvironments: true, featureName: 'engine-node/x' },
        'configs/use-configs': {
            configurations: [],
            hasServerEnvironments: false,
            featureName: 'configs/use-configs'
        }
    }
        }
    },
        environmentProps: {},
        componentType: Dashboard
    }]);
