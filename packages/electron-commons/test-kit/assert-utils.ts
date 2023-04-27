import { expect } from 'chai';

/**
 * Asserts that value is deep equal to one of the specified expected values.
 * @param actual value to test
 * @param list the list of expected values
 */
export function oneOfDeepEqual(actual: any, list: any[]) {
    expect(actual).to.satisfy(() => {
        for (const expected of list) {
            try {
                expect(actual).to.deep.equal(expected);
                return true;
            } catch {
                // continue compare with other items from list
            }
        }
        return false;
    });
}
