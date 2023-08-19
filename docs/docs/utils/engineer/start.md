---
sidebar_position: 1
---
# Start

Usage: `engineer start [options] [path]`

## Options

- `-r`, `--require <path>` - path to require before anything else (default: [])
- `-f`, `--feature <feature>` - feature name is combined using the package name (without the scope (@) and "-feature" parts) and the feature name (file name) - e.g. packageName/featureName.
  featureName and packageName are the same then featureName is sufficient
- `-c`, `--config <config>` - config name is combined using the package name (without the scope (@) and "-feature" parts) and the feature name (file name) - e.g. packageName/featureName.
- `--publicPath <path>` - public path prefix to use as base (default: "/")
- `--singleFeature` - build only the feature set by --feature (default: false)
- `--title <title>` - application title to display in browser
- `--favicon <faviconPath>` - path to favicon to be displayed in browser environments
- `--featureDiscoveryRoot <featureDiscoveryRoot>` - package subdirectory where feature discovery starts
- `--mode <production|development>` - mode passed to webpack (default: "development")
- `--inspect`
- `-p` ,`--port <port>`
- `--open <open>`
- `--autoLaunch [autoLaunch]` -should auto launch node environments if feature name is provided (default: true)
- `--engineerEntry <engineerEntry>` - entry feature for engineer (default: "engineer/gui")
- `--webpackConfig <webpackConfig>` - path to webpack config to build the engine with
- `--nodeEnvironmentsMode <nodeEnvironmentsMode>` one of "new-server", "same-server" or "forked" for choosing how to launch node envs
  --no-log disable console logs
