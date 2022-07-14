# engine

[![Build Status](https://github.com/wixplosives/engine/workflows/tests/badge.svg)](https://github.com/wixplosives/engine/actions)

### Packages

- **[@wixc3/engine-core](https://github.com/wixplosives/engine/tree/master/packages/core)** - core runtime entities.

- **[@wixc3/engine-core-node](https://github.com/wixplosives/engine/tree/master/packages/core-node)** - node-specific entities.

- **[@wixc3/engine-scripts](https://github.com/wixplosives/engine/tree/master/packages/scripts)** - `engine` CLI.

- **[@wixc3/engineer](https://github.com/wixplosives/engine/tree/master/packages/engineer)** - `engine` dev server.

- **[@wixc3/engine-test-kit](https://github.com/wixplosives/engine/tree/master/packages/test-kit)** - `withFeature` and other test mechanisms.

### Publishing new version

In order to publish new version of packages you have to do following:
- switch to `master` branch
- pull latest changes
- run following command in terminal from the root folder:
```
yarn lerna version [patch|minor|major]
```

> NOTE: you will need a permissions to manage tags for repository in order to run this command

This will bump all packages version, tag current commit and push it.
There is a [CI job](https://github.com/wixplosives/engine/actions/workflows/npm.yml) that builds and publishes packages versions to npm.

This job is triggered on each commit and if current version is not yet published, it will publish it.

### License

MIT
