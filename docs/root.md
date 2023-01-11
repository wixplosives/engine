## Approach

- An application is a set of one or more features.
- A feature contains all the integration code required to get a subset of product functionality implemented.
- Features may depend on other features, consume their exposed services and register into their slots.
- A service is a set of functions exposed as an API of a feature.
- A slot is a registry of any type, which allows pluggability via registration.
- Environments (browser/webworker/iframe) are defined by features, and have semantic names (main/processing/preview).
- Each slot and service is available in a specific environment.
- Services can be marked as accessible cross-environments, which exposes them as async APIs in those environment.

## Feature

![[runtime.entities.feature#^feature_pitch:#^feature_files_naming]]

#### Run

`run` Methods are running in parallel after **all** `setup` methods has finished

#### Setup

The `setup` method are running in sync and are in the dependency order

Example

```typescript
import { Feature, Environment, Service } from '@wixc3/engine-core'

const env1 = new Environment('env1', 'node', 'single')

const feat1 = new Feature({
  id: 'feat1',
  api: {
    echoService: Service.withType< echo(): string>().defineEntity(env1)
  },
  dependencies: []
})

feat1.setup(env1, ({}, {})=> {
  return {
    echoService:{
      echo: ()=> 'Hello World'
    }
  }
})

const feat2 = new Feature({
  id: 'feat2',
  api: {},
  dependencies: [feat1]
})

feat2.setup(env1, ({}, {feat1: {echoService}})=> {
  echoService.echo()
})
```

## Topics

- [getting_started](./getting_started.md)
- [examples](./examples.md')
  - [examples.best_practices](./examples.best_practices.md)
  - [examples.best_practices.multi_env](./examples.best_practices.multi_env.md)
  - [examples.react](./examples.react.md)
- [runtime](./runtime.md')
  - [runtime.entities](./runtime.entities.md)
    - [runtime.entities.engine](./runtime.entities.engine.md)
    - [runtime.entities.feature](./runtime.entities.feature.md)
    - [runtime.entities.config](./runtime.entities.config.md)
    - [runtime.entities.slot](./runtime.entities.slot.md)
    - [runtime.entities.service](./runtime.entities.service.md)
    - [runtime.entities.communication](./runtime.entities.communication.md)
      - [runtime.entities.communication.initializers](./runtime.entities.communication.initializers.md)
    - [runtime.entities.environment](./runtime.entities.environment.md)
      - [runtime.entities.environment.targets](./runtime.entities.environment.targets.md)
        - [runtime.entities.environment.targets.node](./runtime.entities.environment.targets.node.md)
        - [runtime.entities.environment.targets.electron](./runtime.entities.environment.targets.electron.md)
        - [runtime.entities.environment.targets.iframe](./runtime.entities.environment.targets.iframe.md)
        - [runtime.entities.environment.targets.context](./runtime.entities.environment.targets.context.md)
- [utils](./utils.md')
  - [utils.engineer](./utils.engineer.md)
    - [utils.engineer.start](./utils.engineer.start.md)
    - [utils.engineer.build](./utils.engineer.build.md)
    - [utils.engineer.create](./utils.engineer.create.md)
    - [utils.engineer.run](./utils.engineer.run.md)
    - [utils.engineer.clean](./utils.engineer.clean.md)
  - [utils.scripts](./utils.scripts.md)
    - [utils.scripts.featureAnalysis](./utils.scripts.featureAnalysis.md)
    - [utils.scripts.build](./utils.scripts.build.md)
  - [utils.electron](./utils.electron.md)
  - [utils.testkit](./utils.testkit.md)
  - [utils.performance](./utils.performance.md)
  - [utils.runtime-node](./utils.runtime-node.md)
    - [utils.runtime-node.node-environment-manager](./utils.runtime-node.node-environment-manager.md)
