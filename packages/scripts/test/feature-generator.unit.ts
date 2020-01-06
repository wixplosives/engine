import { createMemoryFs } from '@file-services/memory';
import fs from '@file-services/node';
import { expect } from 'chai';
import generateFeature, {
    pathToPackagesPath,
    readDirectoryContentsSync,
    writeDirectoryContentsSync,
    mapDirectory,
    enrichContext
} from '../src/feature-generator';
import { expectedDirContents, templatesDirContents, FEATURE_NAME } from './mocks/feature-generator.mocks';
import { compileTemplate } from '../src/utils';

describe('Feature Generator', () => {
    it('reads directory contents', () => {
        const memoryFs = createMemoryFs(templatesDirContents);
        const contentsFromFs = readDirectoryContentsSync(memoryFs, '/');
        expect(contentsFromFs).to.eql(templatesDirContents);
    });

    it('writes directory contents', () => {
        const memoryFs = createMemoryFs();
        writeDirectoryContentsSync(memoryFs, expectedDirContents, '/');
        const contentsFromFs = readDirectoryContentsSync(memoryFs, '/');
        expect(contentsFromFs).to.eql(expectedDirContents);
    });

    it('maps directory contents', () => {
        const dirContents = {
            'text1.txt': 'text1.txt content',
            folder: {
                'text2.txt': 'text2.txt content'
            }
        };
        const mapper = (name: string, content?: string) => ({
            name: `map-${name}`,
            content: `map-${content || ''}`
        });

        const mappedDirectory = mapDirectory(dirContents, mapper);

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

        const featureDir = readDirectoryContentsSync(memoryFs, '/packages');

        expect(featureDir).to.eql(expectedDirContents);
    });

    describe('pathToPackagesPath()', () => {
        const expectedPath = fs.normalize('/proj/packages');

        it('Goes up in path to packages folder', () => {
            expect(pathToPackagesPath(fs, '/proj/packages/some-package')).to.equal(expectedPath);
        });

        it('Adds `packages` to the path if path has no such parent directory', () => {
            expect(pathToPackagesPath(fs, '/proj')).to.equal(expectedPath);
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
