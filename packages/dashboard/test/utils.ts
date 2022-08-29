import {Assertion} from 'chai'
declare global {
    export namespace Chai {
        interface Assertion {
            structure(expected: Object): void;
        }
    }
}

interface Structure {
    name: string
    children?: Structure[]
}
Assertion.addMethod('structure', function (expected: Structure) {
    const actual = this._obj
    this.assert(
        actual.name == expected.name,
        `expected #{this} to have name "${expected.name}", got "${actual.name}"`,
        '',
        expected,
        actual
    )
    new Assertion(actual.children, `Number of children did not match in "${expected.name}"`).to.have.lengthOf(expected.children?.length || 0)
    expected.children?.forEach((child, index) => {
        new Assertion(actual.children[index]).to.have.structure(child)
    })
})
