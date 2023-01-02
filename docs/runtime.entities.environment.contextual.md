A special kind of an environment is the `SingleEndpointContextualEnvironment`.

This is an environment which doesn't know in dev time to which target it resolves.

The main usage for this is if you want your environment to be available in different runtimes, for different products.

We define all the possible targets, and one of them will be resolved at runtime.

The declaration will look something like this:

```ts
// the myContextualEnvironment will be one of serverEnv or workerEnv
// the 'server' environment name of the serverEnv will be used to reference the "'ctx' environment when it's resolved to the 'server' context", which will cause engineer to execute in a node process
// the 'webserver' environment name of the workerEnv will be used to reference the "'ctx' environment when it's resolved to the 'webserver' context", which will cause engineer to bundle the code for this environment, and load it in the browser

const serverEnv = new Environment('server', 'node', 'single');
const workerEnv = new Environment('webserver', 'webworker', 'single');

export const myContextual = new SingleEndpointContextualEnvironment('ctx', [serverEnv, workerEnv]);
```

After declaring that environment, we can, in each feature, to declare that a "context" is provided to setup the feature in this environment.

so for an example We can declare a feature `f1`:

```ts
const f1 = new Feature({
  id: 'f1',
  api: {},
  context: {
    contextName: myContextual.withContext<{ fetchFile: (url: string): Promise<string> }>()
  }
})
```

This means that in the `setup` phase of f1 in the `myContextual` environment, the `fetchFile` method will be available.

```ts
f1.setup(myContextual, (_ownApis, _dependencies, envContext) => {
  // here the `fetchFile` method is avaliable and is able to be used
  envContext.contextName.fetchFile('http://some-url.com').then((fileContents) => {
    console.log(fileContents);
  });
});
```

For the `fetchFile` to be available in the environment setup, we need to provide the actual implementation.

For the `server` context (which will be executed in a node process), we would provide this implementation (for an example)

```ts
import fetch from 'node-fetch';

f1.setupContext(myContextual, 'contextName', () => {
  return {
    fetchFile(url) {
      return fetch(url);
    },
  };
});
```

For the `webserver` context (which will be executed in a browser webworker), we would provide this implementation (for an example)

```ts
f1.setupContext(myContextual, 'contextName', () => {
  return {
    fetchFile(url) {
      return fetch(url);
    },
  };
});
```
