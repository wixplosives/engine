import { isPreenvFile, parsePreenvFileName } from '@wixc3/engine-scripts';
import { expect } from 'chai';

describe('isPreenvFile', () => {
    it('should return false for not valid extention', () => {
        expect(isPreenvFile('file.preenv.md')).to.eq(false);
    });
    it('should return false for valid extention but not preenv', () => {
        expect(isPreenvFile('file.ts')).to.eq(false);
        expect(isPreenvFile('file.js')).to.eq(false);
        expect(isPreenvFile('file.tsx')).to.eq(false);
    });
    it('should return true for valid preenv for regular env', () => {
        expect(isPreenvFile('file.env.preenv.ts')).to.eq(true);
    });
    it('should return true for valid preenv for context', () => {
        expect(isPreenvFile('file.env.context.preenv.ts')).to.eq(true);
    });
});

describe('parsePreenvFileName', () => {
    const featureName = 'featureName';
    const envName = 'envName';
    const contextName = 'contextName';
    it('should detect featureName and envName and no childEnvName if childenv', () => {
        expect(parsePreenvFileName(`${featureName}.${envName}.preenv.ts`)).to.eql({
            featureName,
            envName,
        });
    });
    it('should detect feaure, env and context with contextual', () => {
        expect(parsePreenvFileName(`${featureName}.${envName}.${contextName}.preenv.ts`)).to.eql({
            featureName,
            envName,
            childEnvName: contextName,
        });
    });
    it('should throw if no env', () => {
        expect(() => parsePreenvFileName(`${featureName}.preenv.ts`)).to.throw();
    });
    it('shoud throw if additional unknown parts', () => {
        expect(() =>
            parsePreenvFileName(`${featureName}.${envName}.${contextName}.someotherchunk.preenv.ts`)
        ).to.throw();
    });
});
