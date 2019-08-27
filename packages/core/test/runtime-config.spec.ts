import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { AllEnvironments, entityID, run, Universal } from '../src';
import { Feature } from '../src/entities/feature';
import { RuntimeConfigDefinition } from '../src/entities/runtime-config';
import { Service } from '../src/entities/service';
chai.use(sinonChai);

describe('runtime config', () => {

    it('runtime configs can use defualts', async () => {
        const setupSpy = sinon.spy();
        const compileOptionsSpy = sinon.spy();
        // let projectConfig!: RegistryWriter;
        const definingFeature = new Feature({
            id: 'project',
            api: {
                ProjectConfig: new RuntimeConfigDefinition('project')
            }
        });
        const usingFeature = new Feature({
            id: 'compile',
            api: {
                compileOptions: definingFeature.api.ProjectConfig.defineKey<{ ignorePaths: string[] }>({
                    ignorePaths: ['node_modules']
                })
            },
            dependencies: [definingFeature]
        });

        definingFeature.setup(Universal, () => {
            return null;
        });

        usingFeature.setup(Universal, ({ compileOptions }) => {
            compileOptions.subscribe(compileOptionsSpy);
            setupSpy(compileOptions.getValue());
            return null;
        });

        await run(usingFeature);
        expect(setupSpy.callCount).to.equal(1);
        expect(compileOptionsSpy.callCount).to.equal(0);
        expect(setupSpy.getCall(0).args[0]).to.eql({
            ignorePaths: ['node_modules']
        });

    });
    it('runtime configs defaults can be overriden', async () => {
        const setupSpy = sinon.spy();
        const compileOptionsSpy = sinon.spy();
        // let projectConfig!: RegistryWriter;
        const definingFeature = new Feature({
            id: 'project',
            api: {
                ProjectConfig: new RuntimeConfigDefinition('project')
            }
        });
        const usingFeature = new Feature({
            id: 'compile',
            api: {
                compileOptions: definingFeature.api.ProjectConfig.defineKey<{ ignorePaths: string[] }>({
                    ignorePaths: ['node_modules']
                })
            },
            dependencies: [definingFeature]
        });

        definingFeature.setup(Universal, () => {
            // projectConfig = ProjectConfig;
            return null;
        });

        usingFeature.setup(Universal, ({ compileOptions }) => {
            compileOptions.subscribe(compileOptionsSpy);
            setupSpy(compileOptions.getValue());
            return null;
        });

        await run(usingFeature, [usingFeature.api.compileOptions.use({ ignorePaths: ['zagzag'] })]);
        expect(setupSpy.callCount).to.equal(1);
        expect(compileOptionsSpy.callCount).to.equal(0);
        expect(setupSpy.getCall(0).args[0]).to.eql({
            ignorePaths: ['zagzag']
        });
    });

    it('runtime configs defaults can be changed at runtime', async () => {
        const setupSpy = sinon.spy();
        const compileOptionsSpy = sinon.spy();
        // let projectConfig!: RegistryWriter;
        const definingFeature = new Feature({
            id: 'project',
            api: {
                ProjectConfig: new RuntimeConfigDefinition('project'),
                updateConfig: Service.withType<{
                    set: (config: any) => void;
                }>().defineEntity(AllEnvironments)
            }
        });
        const usingFeature = new Feature({
            id: 'compile',
            api: {
                compileOptions: definingFeature.api.ProjectConfig.defineKey<{ ignorePaths: string[] }>({
                    ignorePaths: ['node_modules']
                })
            },
            dependencies: [definingFeature]
        });

        definingFeature.setup(Universal, ({ ProjectConfig }) => {
            return {
                updateConfig: {
                    set: (config: any) => {
                        ProjectConfig.update(config);
                    }
                }
            };
        });

        usingFeature.setup(Universal, ({ compileOptions }) => {
            compileOptions.subscribe(compileOptionsSpy);
            setupSpy(compileOptions.getValue());
            return null;
        });

        const eng = await run(usingFeature);
        const runningFeature = eng.features.get(definingFeature)!;
        expect(setupSpy.callCount).to.equal(1);
        expect(compileOptionsSpy.callCount).to.equal(0);
        expect(setupSpy.getCall(0).args[0]).to.eql({
            ignorePaths: ['node_modules']
        });
        const id = usingFeature.api.compileOptions.getIdentity();
        const serializeId = entityID(id.featureID, id.entityKey);
        runningFeature.api.updateConfig.set({ [serializeId]: { ignorePaths: ['zagzag'] } });

        expect(setupSpy.callCount).to.equal(1);
        expect(compileOptionsSpy.callCount).to.equal(1);
        expect(compileOptionsSpy.getCall(0).args[0]).to.eql({
            ignorePaths: ['zagzag']
        });

    });
});
