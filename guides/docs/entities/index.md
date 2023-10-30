# Engine

Any engine application consists of two things.

- [environment](environment/index.md)
- [feature](feature/index.md)

The `RuntimeEngine` entity is the engine instance running all the features in every environment of the application.

Every environment, down the line, will do `new RuntimeEngine(...)` and then will call the `.run` method of it.
