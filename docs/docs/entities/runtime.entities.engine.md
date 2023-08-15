Any engine application consists of 2 things.

- [[runtime.entities.feature]]
- [[runtime.entities.environment]]

The `RuntimeEngine` entity is the engine instance running all the features in every environment of the application.

Every environment, down the line, will do `new RuntimeEngine(...)` and then will call the `.run` method of it.

# RuntimeEngine

### **Constructor**

`new Engine(arguments)`

#### arguments

| argument         | description                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| entryEnvironment | `Environment` - the environment the engine is currently running                                        |
| topLevelConfig   | `TopLevelConfig` - the configuration for all the features the engine should load with                  |
| options          | `IRunOptions` - the runtime options to be injected to the engine features under the RUN_OPTIONS symbol |

## Methods

### **run(features)**

Will run the provided features in the previously defined environment

#### arguments

| argument | description                                             |
| -------- | ------------------------------------------------------- |
| features | `Feature/Feature[]` - the root features the engine runs |

#### returns

`Promise<RuntimeEngine>` - the current running engine, after the run phases of all the features finished

### **get(feature)**

Will run the provided features in the previously defined environment

#### arguments

| argument | description                               |
| -------- | ----------------------------------------- |
| feature  | `Feature` - the requested runtime feature |

#### returns

`RuntimeFeature` - the feature after it finished setting itself up.

## Example

the following piece of code:

```ts
const env1 = new Environment('env1', 'node', 'single');
const env2 = new Environment('env2', 'node', 'single');

const f = new Feature({
  id: 'myFeature',
  api: {
    config: new Config<{ name?: string }>({}),
  },
});

f.setup(env1, ({ [RUN_OPTIONS]: runOptions, config }) => {
  console.log('hello env1');
  console.log(runOptions, config);
});

f.setup(env2, ({ [RUN_OPTIONS]: runOptions, config }) => {
  console.log('hello env2');
  console.log(runOptions, config);
});

const runtimeEngine = new RuntimeEngine(
  env1,
  [
    f.use({
      config: {
        name: 'some-name',
      },
    }),
  ],
  new Map([some, 'value']),
);

runtimeEngine.run(f);
```

will output

```
hello env1
[some, 'value'], { name: 'some-name' }
```
