---
id: 7ymyhy88vmwyzkaql4918pl
title: Slot
desc: ''
updated: 1646817063393
created: 1646817063393
---


## How to add a slot

Features declares slots - which are integration points that services can inject data to them. The reason behind this is separation of concerns. ^slots-pitch



Basically it is a a key in the feature that will be injected with a value at the setup phase of a feature, This is super powerful when interacting with slots when composing multiple features as dependencies.

The value will be injected by using the `<slot_name>Slot.register()`

```typescript
myFeature.setup(myEnv, ({myNamedSlot}, {})=> {
  console.log(myNamedSlot) // undefined
  myNamedSlot.register('Yoda')
  console.log(myNamedSlot) // Yoda
})
```
