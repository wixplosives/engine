---
id: 45mpcodad0ur9czkwwrplo4
title: Engine
desc: ''
updated: 1646820089624
created: 1646816329621
---

## In a sentence
Cross runtime dependency injection framework.

Every feature declares it dependencies and its API'S

Features declares slots - which are integration points that services can inject data to me. The reason behind this is separation of concerns.

Plugins are one way, you can only consume from them.

## Feature

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

`Feature` constructor accepts 3 options

### `id: string`

### `Dependencies: []`

The `id` is the unique name of the feature.
### `api: Api`

Api implements 3 types of interfaces:
#### Config

#### Slot

A slot is a way to provide data to the feature in the setup phase, This is super powerful when interacting with slots when composing multiple features as dependencies.

```typescript
myFeature.setup(myEnv, ({myNamedSlot}, {})=> {
  console.log(myNamedSlot) // undefined
  myNamedSlot.register('Yoda')
  console.log(myNamedSlot) // Yoda
})
```

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


## Topics

- [[examples]]
    - [[examples.best_practices]]
- [[runtime]]
  - [[runtime.entities]]
    - [[runtime.entities.engine]]
    - [[runtime.entities.feature]]
    - [[runtime.entities.config]]
    - [[runtime.entities.slot]]
    - [[runtime.entities.service]]
    - [[runtime.entities.communication]]
      - [[runtime.entities.communication.initializers]]
    - [[runtime.entities.environment]]
      - [[runtime.entities.environment.targets]]
        - [[runtime.entities.environment.targets.node]]
        - [[runtime.entities.environment.targets.electron]]
        - [[runtime.entities.environment.targets.iframe]]
        - [[runtime.entities.environment.targets.context]]
- [[utils]]
  - [[utils.engineer]]
  - [[utils.scripts]]
    - [[utils.scripts.featureAnalysis]]
    - [[utils.scripts.build]]
  - [[utils.electron]]
  - [[utils.testkit]]
  - [[utils.performance]]
  - [[utils.runtime-node]]
    - [[utils.runtime-node.node-environment-manager]]


## Powered by Dendron

This is the root of your dendron vault. If you decide to publish your entire vault, this will be your landing page. You are free to customize any part of this page except the frontmatter on top.
This section contains useful links to related resources.

- [Getting Started Guide](https://link.dendron.so/6b25)
- [Discord](https://link.dendron.so/6b23)
- [Home Page](https://wiki.dendron.so/)
- [Github](https://link.dendron.so/6b24)
- [Developer Docs](https://docs.dendron.so/)

