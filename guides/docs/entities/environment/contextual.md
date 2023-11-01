# Contextual Environments

A special kind of environment is the `ContextualEnvironment`.

This is an environment that doesn't know in dev time to which target it resolves.

The main usage for this is if you want your environment to be available in different runtimes, for different products.

We define all the possible targets, and one of them will be resolved at runtime.

The declaration will look something like this:

```ts
// the contextualEnv environment will be one of serverEnv or workerEnv
// the 'server' environment name of the serverEnv will be used to reference the "'ctx' environment when it's resolved to the 'server' context", which will cause engineer to execute in a node process
// the 'webserver' environment name of the workerEnv will be used to reference the "'ctx' environment when it's resolved to the 'webserver' context", which will cause engineer to bundle the code for this environment, and load it in the browser

const serverEnv = new Environment('server', 'node', 'single');
const workerEnv = new Environment('webserver', 'webworker', 'single');

export const contextualEnv = new ContextualEnvironment('ctx', 'single' [serverEnv, workerEnv]);
```

After declaring that environment, we can declare in feature that a "context" is provided to set up this feature in this environment.

So, for an example, we can declare a feature `Feature1`:

```ts
export default class Feature1 extends Feature<'feature1'> {
  id: 'feature1';
  api: {};
  context: {
    contextName: contextualEnv.withContext<{ fetchFile: (url: string): Promise<string> }>()
  }
}
```

This means that in the `setup` phase of `Feature1` in the `contextualEnv` environment,
the `fetchFile` method will be available.

```ts
Feature1.setup(contextualEnv, (_ownApis, _dependencies, envContext) => {
  // here the `fetchFile` method is avaliable and is able to be used
  envContext.contextName.fetchFile('https://some-url.com').then((fileContents) => {
    console.log(fileContents);
  });
});
```

For the `fetchFile` to be available in the environment setup, we need to provide the actual implementation.

For the `server` context (which will be executed in a node process), we would provide this implementation (for an
example)

```ts
import fetch from 'node-fetch';

Feature1.setupContext(contextualEnv, 'contextName', () => {
  return {
    fetchFile(url) {
      return fetch(url);
    },
  };
});
```

For the `webserver` context (which will be executed in a browser webworker), we would provide this implementation (for
an example)

```ts
Feature1.setupContext(contextualEnv, 'contextName', () => {
  return {
    fetchFile(url) {
      return fetch(url);
    },
  };
});
```
