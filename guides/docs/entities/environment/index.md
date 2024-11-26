---
sidebar_position: 2
---

# Environments

## Intro

An Environment is basically a semantic name for an engine instance in a runtime.

In engine applications, features set themselves up in an environment, and when that environment will be
launched at runtime, these setups will happen.

Creating a new environment is as simple as

```ts title="my-feature.feature.ts"
const myEnvironment = new Environment('my-environment', 'node', 'single');
```

### Arguments explanation

_`my-environment`_ - The semantic name of this environment, used as a name serving a purpose for the application,
such as `server`, `processing` or `gui`.
This allows differentiating based based on file name conventions which files belongs to which environment.

:::tip
In case above, environment has name `my-environment`, thus by convention, we will use
file `feature.my-environment.env.ts` for a set-up of a feature on this environment.
:::

_`node`_ - the target on which this environment should be evaluated on

_`single`_ - whether the application should treat this environment as a singleton or a [multiton]

### Targets

<details>
  <summary>The possible targets for an environment</summary>

| target name         | description                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `window`            | an environment which will be bundled, and html will be created for it and will append the bundle to the head of the html |
| `iframe`            | very similar to the window environment, with the exception that it is meant to be a source of an iframe element          |
| `webworker`         | environment which will be loaded in a browser webworker                                                                  |
| `node`              | node environment                                                                                                         |
| `workerthread`      | node worker environment                                                                                                  |
| `electron-renderer` | an environment which will be executed in an electron browser window                                                      |
| `electron-main`     | the root electron process                                                                                                |
| `context`           | TBD                                                                                                                      |

</details>

:::caution
When running engineer, changes to non-browser environments (so not `window`, `iframe` or `webworker`) will require a
restart of the application.
:::

---

At that point, features will be able to set themselves up in that new environment.

## Features set-up on environment

Once an environment is declared, any feature in the application can set itself up in the environment by calling
the `.setup` method on the feature instance, and providing a setup handler.

```ts title="feature1.feature.ts"
export default class Feature1 extends Feature<'feature1'> {
  id = 'feature1' as const;
  api = {};
}
```

```ts title="feature1.my-environment.ts"
import { myEnvironment } from './my-environment.ts';
import Feature1 from './feature1.feature.ts';

Feature1.setup(myEnvironment, () => {
  console.log(`I am running in ${myEnvironment.env}`);
});
```

This will cause this setup to happen, only when the Engine is running for `myEnvironment` environment.

---

In the api declaration of any feature, the user can declare slots and services
which will be available/exported from that environment.

For example, the following feature declaration

```ts title="feature1.feature.ts"
type SlotType = string;

type ServiceType = {
  echo(): string;
};

export default class Feature1 extends Feature<'feature1'> {
  id = 'feature1' as const;
  api = {
    valueSlot: Slot.withType<SlotType>().defineEntity(myEnvironment),
    echoService: Service.withType<ServiceType>().defineEntity(myEnvironment),
  };
}
```

May be setup as such in the `myEnvironment` environment

```ts title="feature1.my-environment.ts"
import Feature1 from './feature1.feature.ts';

Feature1.setup(myEnv, ({ valueSlot, run }) => {
  valueSlot.register('Hello world');

  return {
    echoService: {
      echo() {
        return [...valueSlot].join('\n');
      },
    },
  };
});
```

Now, if a new feature `Feature2` declares a dependency on `Feature1`, it can set itself up in `myEnvironment`
environment and use the APIs exposed from `Feature1`.

```ts title="feature2.feature.ts"
import { Feature1 } from './feature1.feature.ts';

export default class Feature2 extends Feature<'feature2'> {
  id = 'feature2' as const;
  api = {};
  // highlight-next-line
  dependencies = [Feature1];
}
```

```ts title="feature2.my-environment.ts"
import Feature2 from './feature2.feature.ts';

// highlight-next-line
Feature2.setup(myEnvironment, ({ run }, { feature1: { echoService, valueSlot } }) => {
  // highlight-next-line
  valueSlot.register('Hello from Feature2');

  run(() => {
    // highlight-next-line
    const echoeServiceOutput = echoService.echo();

    console.log(echoeServiceOutput);
  });
});
```

Running an engine instance with the `myEnvironment` environment, on `Feature2` will result in the following console
message:

```
Hello world
Hello from Feature2
```

---

For cross-environment communication and further reading, go to the [communication](../communication) section.

But, for example, a file-server feature which should provide Node `readDir` and `readFile` can run on two (or more)
different environments: `node` or `window`, Then we will define them as follows:

```ts
/**
 * defining that this feature uses 2 environments - 'main' (browser) and LiveServer environment with the semantic name 'server'
 */
export const main = new Environment('main', 'window', 'single');
export const server = new Environment('server', 'node', 'single');
```

If the feature API requires a specific entity which natively provides this functionality, we will use
the `.defineEntity(<entity_name>)`

```ts
Service.withType<FileSystemAPI>().defineEntity(server).allowRemoteAccess();
```
