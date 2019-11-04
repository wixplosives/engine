import { createMultipleComponentSimulations } from '@wixc3/simulation-core';
import { Dashboard } from '../../packages/scripts/src/engine-dashboard/components/dashboard';
import { features } from './features';

export default createMultipleComponentSimulations([
    {
        name: 'New Simulation',
        readOnly: false,
        props: {
            fetchServerState: {
                value: async () => ({
                    result: 'success',
                    data: {
                        features,
                        featuresWithRunningNodeEnvs: []
                    }
                })
            }
        },
        environmentProps: {},
        componentType: Dashboard
    }
]);
