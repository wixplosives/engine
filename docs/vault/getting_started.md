---
id: 3exet4jj85h5gdb9qu9yk0d
title: Getting started
desc: ''
updated: 1650184933682
created: 1649931104026
---

# Getting started with the engine

After understanding a bit about the engine, let's create a simple hello-world app with an engine feature.

## Prerequisites

In your blank typescript repo:

1. install engine-core package `yarn add @wixc3/engine-core`
2. install engineer as a dev dependency `yarn add @wixc3/engineer -D`
3. if this is a typescript project, in the root of the project create an `engine.config.js` file, and inside we should add one of the following:

```ts
module.exports = {
  // a require hook to a library which transpiles typescript on the fly
  require: ['@ts-tools/node/r'],

  // the folder where the transpiled js files will be located
  featureDiscoveryRoot: 'dist',
};
```

Then, let's create 2 files in the `src` folder
a. hello-world.feature.ts
b. hello-world.my-env.env.ts

### hello-world.feature

Let's paste these contents to the file

```ts
import { Feature, Environment } from '@wixc3/engine-core';

// this is the environment in which this feature will set itself up
export const myEnv = new Environment('my-env', 'node', 'single');

// our first feature
export default new Feature({
  id: 'helloWorldFeature',
  api: {},
});
```

We create the feature file, in which we declare what is the feature's API and its Id.
We also create a new environment - `my-env`.

###### \* It is important to export the environment from the feature file, this is how `engineer` picks it up

### hello-world.my-env.env.ts

Let's paste these contents to the file

```ts
import helloWorldFeature, { myEnv } from './hello-world.feature';

helloWorldFeature.setup(myEnv, ({ run }) => {
  console.log('hello');

  run(() => {
    console.log('world');
  });
});
```

We set our feature up in the `my-env` environment.
In the setup phase of the feature, we will print `hello`
In the run phase, we will print `world`.

## Running the feature

In order to run this feature, all we need to do, is in the terminal just to run `npx engineer start -f hello-world` .
This command will locate from the `process.cwd()` or `join(process.cwd(), featureDiscoveryRoot)` if provided, the `hello-world` feature and run it.

###### \* The `-f` and `-c` flags in engineer are calculated as follows:

###### 1. find the name of the closest package.

###### 2. remove the scope, if exists, and the `-feature` suffix of exists.

###### 3. if the feature name is different then the result in #2, append the feature name (as stated in the file name) with a `/`.

###### for an example, if, in our example, the package name was `@example/hello-feature` then the call to engineer would be `npx engineer start -f hello/hello-world`, while if the package name was `@example/hello-world-feature`, the call to engineer would be `npx engineer start -f hello-world`

We should see `hello` followd by `world` written in the console.

For a living example, go to `examples/hello-world` and run `yarn start`
