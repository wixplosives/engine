---
sidebar_position: 2
---

# Build

## Options

- `--publicPath <path>` - public path prefix to use as base (default: "/")
- `--publicPathVariableName <publicPathVariableName>` - global variable name where public path is stored
- `--inspect`
- `--singleFeature` - build only the feature set by --feature (default: false)
- `--title <title>` - application title to display in browser
- `--favicon <faviconPath>` - path to favicon to be displayed in browser environments
- `--featureDiscoveryRoot <featureDiscoveryRoot>` - package subdirectory where feature discovery starts
- `--mode <production|development>` - mode passed to webpack (default: "production")
- `--outDir <outDir>` - output directory for the built application (default: "dist-app")
- `--webpackConfig <webpackConfig>` - path to webpack config to build the application with
- `--publicConfigsRoute <publicConfigsRoute>` - public route for configurations
- `--external [true|false]` - build feature as external (default: false)
- `--eagerEntrypoints [true|false]` - build feature as external (default: false)
- `--configLoaderModuleName [configLoaderModuleName]` - custom config loader module name. used for static builds only
- `--sourcesRoot <sourcesRoot>` - the directory where the feature library will be published at (relative to the base path). default: "."
- `--staticExternalsDescriptor <staticExternalsDescriptor>` - relative to the output directory - a path to a json file which retrieves all external feature descriptors
- `--includeExternalFeatures <includeExternalFeatures>` - should include defined external features in the built output (default: false)
