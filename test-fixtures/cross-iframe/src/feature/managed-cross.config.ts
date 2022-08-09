import fixture from './configured-iframe.feature';

export default [
    fixture.use({
        config: {
            managed: true,
            origin: '//127.0.0.1:3000',
        },
    }),
];
