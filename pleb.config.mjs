export default {
    pinnedPackages: [
        { name: 'open', reason: 'v9 is pure esm' },
        { name: 'chai', reason: 'v5 is pure esm' },
        { name: 'chai-as-promised', reason: 'v8 is pure esm' },
        { name: '@types/chai-as-promised', reason: 'v8 is pure esm' },
        { name: 'sinon-chai', reason: 'v4 requires chai@5' },
        { name: 'typescript-eslint', reason: '8.6.0 has a crash to be fixed in next release' },
    ],
};
