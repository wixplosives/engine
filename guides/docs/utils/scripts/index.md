# @wixc3/engine-scripts

Tooling for building and running of applications written using the `@wixc3/engine-core` package.

## `engine create [feature-name]`

Generates a feature folder with all basic imports and declarations.

- `feature-name` should be dash-separated
- optional `featuresDir` argument for specifying the path to the features directory in the project .
- optional `templatesDir` argument for having customized templates/folder structure

### `engine.config.js` options

- `featuresDirectory` - same as `featuresDir` in CLI options
- `featureTemplatesFolder` - same as `templatesDir` in CLI options
- `featureFolderNameTemplate` - for overriding default feature folder name template (see [Templating options](#templating-options))

### Templating options

If you wish to work with your own templates directory, using the `templatesDir` option, you can use `${featureName}` in your customized templates whenever you want, including folder names.
Each file/folder name you want as a template should end with `.tmpl`, other extensions/folder names are ignored and get copied as they are.

#### Possible spacial casing for your templates:

- camelCase: `${featureName.camelCase}`
- dash-case: `${featureName.dashCase}`
- PascalCase: `${featureName.pascalCase}`

For example, given the following templates' folder:

- feature
  - \${featureName.dashCase}.feature.ts.tmpl = `export const ${featureName.camelCase} = ...`
- test-\${featureName.dashCase}.tmpl
  - \${featureName.dashCase}.spec.ts.tmpl = `describe('${featureName.pascalCase} feature', () => ...`
- README.md = `Hi ${featureName.pascalCase}!`

If `featureName` is `cool-thing`, the parsed folder will be:

- feature
  - cool-thing.feature.ts = `export const coolThing = ...`
- test-cool-thing
  - cool-thing.spec.ts = `describe('CoolThing feature', () => ...`
- README.md = `Hi ${featureName.pascalCase}!` (NOT PARSED, file doesn't end with `.tmpl`)
