This project is meant to simulate a pluggable react rednering application in order to test how react hot reloading might work with it

We have a rendering feature that provides a rendering service
We have a gui service which exposes a slot to register react elements and renders the contents of the slot using the rendering service
We have a plugin that registers 2 elements into said slot, 1 inlines, the other imported from a file

We support react hot refesh for react only components
