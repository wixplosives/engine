import { expect } from 'chai';
import { createMemoryFs } from '@file-services/memory';
import { ensureTracePath } from '../src/utils/trace';
const zipExt = '.zip';

describe('ensure trace path', () => {
    const fs = createMemoryFs({
        a: {
            b: {
                c: '',
            },
            d: {},
        },
    });

    it('ensures directory if directory doesnt exist', () => {
        const dirname = '/a/b/d';
        const filePath = fs.join(dirname, `b${zipExt}`);
        expect(
            ensureTracePath({
                fs,
                filePath: filePath,
            })
        ).to.eq(filePath);
        expect(fs.directoryExistsSync(dirname)).to.eq(true);
    });

    it('uses fallback names', () => {
        const fallbackNameWithoutSpaces = 'filename';
        const fallbackNameWithSpaces = 'with spaces';
        const filePath = '/a/b/';

        expect(
            ensureTracePath({
                fs,
                filePath,
                fallbackName: fallbackNameWithoutSpaces + zipExt,
            }),
            `fails for ${fallbackNameWithoutSpaces}${zipExt}`
        ).to.eq(filePath + fallbackNameWithoutSpaces + zipExt);

        expect(
            ensureTracePath({
                fs,
                filePath,
                fallbackName: fallbackNameWithoutSpaces,
            }),
            `fails for ${fallbackNameWithoutSpaces}`
        ).to.eq(filePath + fallbackNameWithoutSpaces + zipExt);

        expect(
            ensureTracePath({
                fs,
                filePath,
                fallbackName: fallbackNameWithSpaces + zipExt,
            }),
            `fails for ${fallbackNameWithSpaces}${zipExt}`
        ).to.eq(filePath + fallbackNameWithSpaces.replace(' ', '_') + zipExt);

        expect(
            ensureTracePath({
                fs,
                filePath,
                fallbackName: fallbackNameWithSpaces,
            }),
            `fails for ${fallbackNameWithSpaces}`
        ).to.eq(filePath + fallbackNameWithSpaces.replace(' ', '_') + zipExt);
    });

    it('generates new file name if not provided', () => {
        const filePath = '/a/b';
        const traceFilePath = ensureTracePath({
            fs,
            filePath,
        });
        expect(traceFilePath.endsWith(zipExt)).to.eq(true);
        expect(fs.dirname(traceFilePath)).to.eq(filePath);
    });
});
