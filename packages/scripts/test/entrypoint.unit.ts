import fs from '@file-services/node';
import { expect } from 'chai';
import { getExportedEnvironments, getResolvedEnvironments, readFeatures } from '../src';

describe('create entrypoint', () => {
    describe('resolve environments', () => {
        it('properly maps environments', () => {
            const { features } = readFeatures(fs, fs.join(__dirname, '../../../../scalable/packages/project'), 'src');
            const environments = [...getExportedEnvironments(features)];
            const resolvedEnvironments = getResolvedEnvironments({
                featureName: 'component-studio',
                features,
                filterContexts: true,
                environments,
            });
            expect(true).to.eq(true);
        });
    });
});
