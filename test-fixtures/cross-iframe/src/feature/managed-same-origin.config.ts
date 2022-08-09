import fixture from './configured-iframe.feature';

export default [
    fixture.use({
        config: {
            managed: true,
        },
    }),
];
