This project is meant to simulate a pluggable react rednering application in order to test how react hot reloading might work with it

We have a rendering feature that provides a rendering service
We have a gui service which exposes a slot to register react elements and renders the contents of the slot using the rendering service
We have a plugin that registers 2 elements into said slot, 1 inlines, the other imported from a file

# Hot reloading

Engine supports webpack hot reloading using the --webpackHot flag

To activate webpack hot reloading one needs to

1. Add `new ReactRefreshPlugin({ overlay: { sockIntegration: 'whm', }, })`
   To your plugin array

2. Add the relevant transformation
   2.1 Babel - Add the babel tranformation ('react-refresh/babel') to your babel plugins
   2.2 Typescript - Add a new instance of `'react-refresh-typescript'` to the before transformations of your typescript loader
   2.2.1 See webpack.config.hot.js for an example with ts-tools
   2.2.2 See an example from here[https://github.com/pmmmwh/react-refresh-webpack-plugin#with-ts-loader]

To run the example without hot reloading start with `yarn start`, to run with hot reloading run `yarn start:hot`
