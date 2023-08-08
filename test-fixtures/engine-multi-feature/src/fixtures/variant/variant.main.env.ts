import { MAIN } from '@fixture/3rd-party/dist/3rd-party.feature.js';
import Variant from './variant.feature.js';

Variant.setup(MAIN, ({}, { MultiFeature: { mySlot } }) => {
    mySlot.register('testing 1 2 3');
});
