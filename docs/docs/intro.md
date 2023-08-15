---
title: Introduction
sidebar_position: 1
---
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
