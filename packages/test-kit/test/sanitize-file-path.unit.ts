import { sanitizeFilePath } from '@wixc3/engine-test-kit';
import { expect } from 'chai';

describe('Sanitize file path', () => {
    it('Doesnt damage valid windows paths', () => {
        const original = 'C:\\Users\\John\\123dogs\\cats';
        const result = sanitizeFilePath(original);
        expect(result).to.equal(original);
    });
    it('Doesnt damage valid mac paths', () => {
        const original = '/Users/John/123dogs/cats';
        const result = sanitizeFilePath(original);
        expect(result).to.equal(original);
    });
    it('Doesnt allow to inject in the disk path', () => {
        const original = 'C:sfafaf\\Users\\John\\123dogs\\cats';
        const result = sanitizeFilePath(original);
        expect(result).to.equal('C-sfafaf\\Users\\John\\123dogs\\cats');
    });
    it('Sanitizes path', () => {
        const original = '/Users:command/<123>John/123?do*gs/cats';
        const result = sanitizeFilePath(original);
        expect(result).to.equal('/Users-command/-123-John/123-do-gs/cats');
    });
});
