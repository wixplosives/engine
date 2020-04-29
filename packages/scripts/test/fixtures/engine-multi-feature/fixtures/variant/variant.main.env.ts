import { MAIN } from '@fixture/3rd-party/3rd-party.feature';
import Variant from './variant.feature';

Variant.setup(MAIN, ({}, { MultiFeature: { mySlot } }) => {
    mySlot.register('testing 1 2 3');
});
