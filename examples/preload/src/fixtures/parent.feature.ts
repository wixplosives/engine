import { Feature } from '@wixc3/engine-core';
import allFeature from '../feature/all.feature';

export default class Parent extends Feature<'parent'> {
    id = 'parent' as const;
    api = {};
    dependencies = [allFeature];
}
