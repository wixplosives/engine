import { createMemoryFs } from '@file-services/memory';
import fs from '@file-services/node';
import { expect } from 'chai';
import generateFeature, { pathToPackagesPath } from '../src/feature-generator';
import { expectedDirContents, templatesDirContents, FEATURE_NAME } from './mocks/feature-generator.mocks';
import { readDirectorySync, writeDirectorySync, mapDirectory, enrichContext } from '../src/feature-generator/utils';
import { compileTemplate } from '../src/utils/string-utils';

describe('Feature Generator', () => {
    it('reads sync directory', () => {
        const memoryFs = createMemoryFs(templatesDirContents);
        const contentsFromFs = readDirectorySync(memoryFs, '/');
        expect(contentsFromFs).to.eql(templatesDirContents);
    });

    it('writes sync directory', () => {
        const memoryFs = createMemoryFs();
        writeDirectorySync(memoryFs, expectedDirContents, '/');
        const contentsFromFs = readDirectorySync(memoryFs, '/');
        expect(contentsFromFs).to.eql(expectedDirContents);
    });

    it('maps directory content', () => {
        const dirContent = {
            'text1.txt': 'text1.txt content',
            folder: {
                'text2.txt': 'text2.txt content'
            }
        };
        const mapper = (name: string, content?: string) => ({
            name: `map-${name}`,
            content: `map-${content || ''}`
        });

        const mappedDirectory = mapDirectory(dirContent, mapper);

        expect(mappedDirectory).to.eql({
            'map-text1.txt': 'map-text1.txt content',
            'map-folder': {
                'map-text2.txt': 'map-text2.txt content'
            }
        });
    });

    it('generates a feature directory from templates directory', () => {
        const memoryFs = createMemoryFs({
            templates: templatesDirContents
        });

        generateFeature(memoryFs, {
            featureName: FEATURE_NAME,
            targetPath: '/packages',
            templatesDirPath: '/templates'
        });

        const featureDir = readDirectorySync(memoryFs, '/packages');

        expect(featureDir).to.eql(expectedDirContents);
    });

    describe('pathToPackagesPath()', () => {
        it('Goes up in path to packages folder', () => {
            expect(pathToPackagesPath(fs, '/proj/packages/some-package')).to.equal('/proj/packages');
        });

        it('Adds `packages` to the path if path has no such parent directory', () => {
            expect(pathToPackagesPath(fs, '/proj')).to.equal('/proj/packages');
        });
    });

    describe('enrichContext()', () => {
        it('keeps original context', () => {
            const featureName = 'Bla-Bla';
            const template = '${featureName}';
            const enrichedContext = enrichContext({ featureName });
            const transformed = compileTemplate(template)(enrichedContext);
            const expected = 'Bla-Bla';
            expect(transformed).to.equal(expected);
        });

        it('adds camelCase option', () => {
            const featureName = 'Bla-Bla';
            const template = '${featureName.camelCase}';
            const enrichedContext = enrichContext({ featureName });
            const transformed = compileTemplate(template)(enrichedContext);
            const expected = 'blaBla';
            expect(transformed).to.equal(expected);
        });

        it('adds dashCase option', () => {
            const featureName = 'Bla-Bla';
            const template = '${featureName.dashCase}';
            const enrichedContext = enrichContext({ featureName });
            const transformed = compileTemplate(template)(enrichedContext);
            const expected = 'bla-bla';
            expect(transformed).to.equal(expected);
        });

        it('adds pascalCase option', () => {
            const featureName = 'Bla-Bla';
            const template = '${featureName.pascalCase}';
            const enrichedContext = enrichContext({ featureName });
            const transformed = compileTemplate(template)(enrichedContext);
            const expected = 'BlaBla';
            expect(transformed).to.equal(expected);
        });
    });
});
