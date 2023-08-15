A feature is combined of several files: ^feature_pitch

- `<feature-name>.feature.ts` - feature definition file.
- `<feature-name>.<some-env>.env.ts` - some-env specific setup code. ^feature_env_file_example
- `<feature-name>.<another-env>.env.ts` - another-env specific setup code.

^feature_files_naming

### Feature definition file

Feature definition is created in a `<feature-name>.feature.ts` file, and is exposed as the `default` export.

For example:

```ts
/* my-feature.feature.ts */

import { Feature } from '@wixc3/engine-core';

/* defining a new feature */
export default new Feature({
  id: 'myFeature' /* unique id for the feature */,

  dependencies: [
    /* other features the feature depends on */
  ],

  api: {
    /* slots, services, and configurations of the feature */
  },
});
```

^feature_constructor

`Feature` constructor accepts 3 options

### `id: string`

Unique identifier, This is the feature name. For example a `file-server` feature will be initiated as `const fileServerFeature = new Feature({id: 'file-server', ...rest})` and the rest of the folder structure should be prefixed with `file-server`.

![Feature file structure](../../static/img/feature_folder_example.png){max-width: 300px}

### `Dependencies: []`

Features that this current feature is dependant upon

### `api: Api`

Api implements 3 types of interfaces:

#### Config

#### Slot

![[runtime.entities.slot#^slots-pitch]]

#### Service

Service is a method within an API. When we need to declare API methods we will call the `Service.withType` static.

```typescript
const myFeature = new Feature({
  id: 'myFeature',
  api: {
    echoService: Service.withType< echo(): string>().defineEntity(env1)
  },
  // etc..
})
```

## `Feature` instance

### setup(env, handler)

This is the method of a feature to set itself up in an [[runtime.entities.environment]]

#### arguments

| argument | description                                                                         |
| -------- | ----------------------------------------------------------------------------------- |
| env      | [[runtime.entities.environment]] - the environemnt we want to set the feature up in |
| handler  | [[Set up handler\|runtime.entities.feature#^setup_handler]]                         |

#### Setup handler

^setup_handler

The setup handler is a method being called with 3 arguments.

```ts
myFeature.setup(myEnv, (settingUpFeature, dependencies, contexts) => { ... });
```

- **_settingUpFeature_** - all the entities related to the feature:

| argument  | description                                                                            |
| --------- | -------------------------------------------------------------------------------------- |
| id        | (_string_) - id                                                                        |
| run       | (method) - [[run method\|runtime.entities.feature#^run_method]]                        |
| onDispose | (method) - a method will be called once this feature gets disposed in this environment |
| Own slots | all the slots defined in the feature api for this environment                          |
| Configs   | all the configurations defined in the feature api and accessible in this environment   |

#### `run(cb: Function)`

^run_method

This will be called when the environment is ready. For example, when we want to render a react component we need the document to be ready. In this case we will insert all react rendering logic inside the `run` method.

- **_dependencies_** - a list of all the dependencies the feature declared dependency on, and all the api's available from that feature in the current environment

- **_contexts_** - api's provided to the specific environment in case the environment is a [[contextual environment|runtime.entities.environment.targets]]

### setupContext(env, contextName,handler)

In case the environment is a [[contextual environment|runtime.entities.environment.targets]], this is how we can provide a specific context to the environment.

```ts
myFeature.setupContext(myEnv, 'envContext', (deps) => {
  return {
    method: () => 'from context',
  };
});
```

##### For an example of a minimal contextual environment look at `/examples/multi-env`
