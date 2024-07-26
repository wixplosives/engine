export default {
    pinnedPackages: [
        { name: 'open', reason: 'v9 is pure esm' },
        { name: 'chai', reason: 'v5 is pure esm' },
        { name: 'chai-as-promised', reason: 'v8 is pure esm' },
        { name: 'sinon-chai', reason: 'v4 requires chai@5' },
        { name: 'eslint', reason: 'plugins are not yet compatible with v9' },
    ],
};
