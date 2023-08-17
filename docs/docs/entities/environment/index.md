---
sidebar_position: 2
---
# Environments

An Environment is basically a semantic name for an engine instance in a runtime.

In engine applications, [feature](../feature)s sets themselfes up in an environment, and when that environment will be launched at runtime, these setups will happen.

Creating a new environment is as simple as

```ts
const myEnv = new Environment('my-env', 'node', 'single');
```

---

### Arguments explanation

_my-env (string)_ - The semantic name of this environment. this allows differentiating based based on file name conventions which files belongs to which environment.
This is also used as a name surving a purpose for the application, such as `server`, `processing` or `gui`.

_node_ - The target on which this environment should be evaluated on.

The possible targets for an environment

| target name       | description                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| window            | an environment which will be bundled, and html will be created for it and will append the bundle to the head of the html |
| iframe            | very similar to the window environment, with the exception that it is ment to be a source of an ifame element            |
| node              | node environment                                                                                                         |
| webworker         | environment which will be loaded in a browser webworker                                                                  |
| electron-renderer | an environment which will be executed in an electron browser window                                                      |
| electron-main     | the root electron process                                                                                                |
| context           | [[runtime.entities.environment.targets.context]]                                                                         |

--

_single_ - wheather the application should treat this environment as a singleton or a multiton

---

... in that point features will be able to set themself up in that new environment.

Once an environment is declared, any feature in the application can set itself up in the environment by calling the `.setup` method on the feature instance, and providing a [[setup handler|runtime.entities.feature#^setup_handler]].

```ts
const f = new Feature({
  id: 'myFeature',
  api: {},
});

f.setup(myEnv, () => {
  console.log(`I am running in ${myEnv.env}`);
});
```

This will cause this setup to happen, only when the [[runtime.entities.engine]] is running for `myEnv` environment.

In the api declaration of any feature, the user can declare [[runtime.entities.slot]]s and [[runtime.entities.service]]s which will be available/exported from that environment.

for an example the following feature declaration

```ts
const f1 = new Feature({
  id: 'f1',
  api: {
    valueSlot: Slot.withType<string>().defineEntity(myEnv),
    echoService: Service.withType<{
      echo(): string;
    }>().defineEntity(myEnv),
  },
});
```

May be setup as such in the `myEnv` environment

```ts
f1.setup(myEnv, ({ valueSlot, run }) => {
  valueSlot.register('hello world');
  return {
    echoService: {
      echo() {
        return [...valueSlot].join('\n');
      },
    },
  };
});
```

Now, if a new feature `f2` is declares a dependency on `f1`, it can set itself up in `myEnv` environment and use the api's exposed from f1.

```ts
const f2 = new Feature({
  id: 'f2',
  api: {},
  dependencies: [f1],
});

f2.setup(myEnv, ({ run }, { f1: { echoService, valueSlot } }) => {
  valueSlot.register('hello from f2');

  run(() => {
    console.log(echoService.echo());
  });
});
```

Running an engine instance with the `myEnv` environment, on `f2` will result in the following console message:

```
hello world
hello from f2
```

For cross environment communication and further reading, go to [[runtime.entities.communication]]

But, for example, a file-server feature which should provide Node `readDir` and `readFile` can run on two (or more) different environments: `node` or `window`, Then we will define them as follows:

```typescript
/**
 * defining that this feature uses 2 environments - 'main' (browser) and LiveServer environment with the semantic name 'server'
 */
export const main = new Environment('main', 'window', 'single');
export const server = new Environment('server', 'node', 'single');
```

If the feature API requires a specific entity which natively provides this functionality we will use the `.defineEntity(<entity_name>)`

```typescript
Service.withType<FileSystemAPI>().defineEntity(server).allowRemoteAccess();
```
