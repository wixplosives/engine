import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import { Environment, Feature, Service } from '../src';
import { ConfgurableSlot, run } from '../src';
chai.use(sinonChai);

describe('configurable-slot', () => {
    const env = new Environment('main', 'window', 'single');
    const definingFeature = new Feature({
        id: 'slotable',
        api: {
            slot: ConfgurableSlot.withType<{
                id: string,
                label: string
            }>().defineEntity(env),
            readSlot: Service.withType<{ read: () => string[] }>().defineEntity(env)
        }
    });
    definingFeature.setup(env, ({ slot }) => {
        slot.register({
            id: 'a',
            label: 'label a'
        });
        return {
            readSlot: {
                read() {
                    return [...slot].map(item => item.label);
                }
            }
        };
    });

    const secondFeature = new Feature({
        id: '2',
        api: {},
        dependencies: [definingFeature]
    });
    secondFeature.setup(env, (_a, { slotable: { slot } }) => {
        slot.register({
            id: 'b',
            label: 'label b'
        });
        return null;
    });
    const thirdFeature = new Feature({
        id: '3',
        api: {},
        dependencies: [definingFeature]
    });
    thirdFeature.setup(env, (_a, { slotable: { slot } }) => {
        slot.register({
            id: 'c',
            label: 'label c'
        });
        return null;
    });
    const fourthFeature = new Feature({
        id: '4',
        api: {},
        dependencies: [secondFeature, thirdFeature]
    });

    it('should sort items according to config', () => {
        const app = run({
            entryFeature: fourthFeature,
            envName: 'main',
            topLevelConfig: [
                definingFeature.use({
                    slot: {
                        order: ['c', 'b', 'a']
                    }
                })
            ]
        });
        const runningFeature = app.features.get(definingFeature);
        expect(runningFeature!.api.readSlot.read()).to.eql(['label c', 'label b', 'label a']);
    });
    it('should not sort items if no config given', () => {
        const app = run({
            entryFeature: fourthFeature,
            envName: 'main'
        });
        const runningFeature = app.features.get(definingFeature);
        expect(runningFeature!.api.readSlot.read()).to.eql(['label a', 'label b', 'label c']);
    });

    it('should place items out of config in the end', () => {
        const app = run({
            entryFeature: fourthFeature,
            envName: 'main',
            topLevelConfig: [
                definingFeature.use({
                    slot: {
                        order: ['c']
                    }
                })
            ]
        });
        const runningFeature = app.features.get(definingFeature);
        expect(runningFeature!.api.readSlot.read()).to.eql(['label c', 'label a', 'label b']);
    });
});
