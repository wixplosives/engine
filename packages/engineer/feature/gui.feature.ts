import { Feature, Environment, COM } from '@wixc3/engine-core/src';
import buildFeature from './dev-server.feature';
export const mainDashboardEnv = new Environment('main-dashboard', 'window', 'single');

export default new Feature({
    id: 'dashboard-gui',
    dependencies: [buildFeature, COM],
    api: {},
});
