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
        const outPath = '/a/b/d';
        const name = `b${zipExt}`;
        expect(
            ensureTracePath({
                fs,
                outPath,
                name,
            })
        ).to.eq(fs.join(outPath, name));
        expect(fs.directoryExistsSync(outPath)).to.eq(true);
    });

    it('uses fallback names', () => {
        const fallbackNameWithoutSpaces = 'filename';
        const fallbackNameWithSpaces = 'with spaces';
        const filePath = '/a/b/';

        expect(
            ensureTracePath({
                fs,
                outPath: filePath,
                name: fallbackNameWithoutSpaces + zipExt,
            }),
            `fails for ${fallbackNameWithoutSpaces}${zipExt}`
        ).to.eq(filePath + fallbackNameWithoutSpaces + zipExt);

        expect(
            ensureTracePath({
                fs,
                outPath: filePath,
                name: fallbackNameWithoutSpaces,
            }),
            `fails for ${fallbackNameWithoutSpaces}`
        ).to.eq(filePath + fallbackNameWithoutSpaces + zipExt);

        expect(
            ensureTracePath({
                fs,
                outPath: filePath,
                name: fallbackNameWithSpaces + zipExt,
            }),
            `fails for ${fallbackNameWithSpaces}${zipExt}`
        ).to.eq(filePath + fallbackNameWithSpaces.replace(' ', '_') + zipExt);

        expect(
            ensureTracePath({
                fs,
                outPath: filePath,
                name: fallbackNameWithSpaces,
            }),
            `fails for ${fallbackNameWithSpaces}`
        ).to.eq(filePath + fallbackNameWithSpaces.replace(' ', '_') + zipExt);
    });

    it('generates new file name if not provided', () => {
        const filePath = '/a/b';
        const traceFilePath = ensureTracePath({
            fs,
            outPath: filePath,
        });
        expect(traceFilePath.endsWith(zipExt)).to.eq(true);
        expect(fs.dirname(traceFilePath)).to.eq(filePath);
    });
});
