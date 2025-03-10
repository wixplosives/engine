import { expect } from 'chai';
import { runPreBuilds } from '@wixc3/engine-cli';
import { writeFileSync, existsSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { cwd } from 'node:process';

const createdFiles: string[] = [];

function writeTestFile(filePath: string, content: string): void {
    writeFileSync(filePath, content);
    createdFiles.push(filePath);
}

const mockSrcDir = path.join(cwd(), 'mock-src');
const outputDir = path.join(cwd(), 'output');

describe('runPreBuilds', () => {
    beforeEach(() => {
        mkdirSync(mockSrcDir, { recursive: true });
    });

    afterEach(() => {
        createdFiles.forEach((file) => {
            if (existsSync(file)) {
                unlinkSync(file);
            }
        });
        createdFiles.length = 0;
        if (existsSync(outputDir)) {
            rmSync(outputDir, { recursive: true });
        }
        if (existsSync(mockSrcDir)) {
            rmSync(mockSrcDir, { recursive: true });
        }
    });

    it('should build for node and web to specific directory', async () => {
        const filePath = path.join(mockSrcDir, 'file.js');
        writeTestFile(filePath, '');

        await runPreBuilds(
            mockSrcDir,
            path.join(cwd(), 'output'),
            [filePath],
            false,
            {
                nodeConfig: { outdir: 'output/node' } as any,
                webConfig: { outdir: 'output/web' } as any,
            },
            'both',
            false,
        );

        expect(existsSync(path.join(outputDir, 'node'))).to.be.true;
        expect(existsSync(path.join(outputDir, 'web'))).to.be.true;
    });

    it('should not build if the paths are empty', async () => {
        await runPreBuilds(
            mockSrcDir,
            path.join(cwd(), 'output'),
            [],
            false,
            {
                nodeConfig: { outdir: 'output/node' } as any,
                webConfig: { outdir: 'output/web' } as any,
            },
            'both',
            true,
        );

        expect(existsSync(path.join(outputDir, 'node'))).to.be.false;
        expect(existsSync(path.join(outputDir, 'web'))).to.be.false;
    });
});
