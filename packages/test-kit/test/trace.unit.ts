import { expect } from 'chai';
import { createMemoryFs } from '@file-services/memory';
import { ensureTracePath, TRACE_FILE_EXT } from '@wixc3/engine-test-kit/dist/utils';

describe('ensure trace path', () => {
    const fs = createMemoryFs({
        a: {
            b: {
                c: '',
            },
            d: {},
        },
    });

    it('generates a random file name if not provided', () => {
        const filePath = '/a/b';
        const traceFilePath = ensureTracePath({
            fs,
            outPath: filePath,
        });
        expect(traceFilePath.endsWith(TRACE_FILE_EXT)).to.eq(true);
        expect(fs.dirname(traceFilePath)).to.eq(filePath);
    });

    it('uses provided name', () => {
        const fallbackNameWithoutSpaces = 'filename';
        const filePath = '/a/b/';

        expect(
            ensureTracePath({
                fs,
                outPath: filePath,
                name: fallbackNameWithoutSpaces + TRACE_FILE_EXT,
            }),
            `fails for ${fallbackNameWithoutSpaces}${TRACE_FILE_EXT}`,
        ).to.eq(filePath + fallbackNameWithoutSpaces + TRACE_FILE_EXT);

        expect(
            ensureTracePath({
                fs,
                outPath: filePath,
                name: fallbackNameWithoutSpaces,
            }),
            `fails for ${fallbackNameWithoutSpaces}`,
        ).to.eq(filePath + fallbackNameWithoutSpaces + TRACE_FILE_EXT);
    });

    it('ensures directory exists', () => {
        const outPath = '/a/b/d';
        const name = `b${TRACE_FILE_EXT}`;
        expect(
            ensureTracePath({
                fs,
                outPath,
                name,
            }),
        ).to.eq(fs.join(outPath, name));
        expect(fs.directoryExistsSync(outPath)).to.eq(true);
    });
});
