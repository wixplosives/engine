import type { EQUAL, ExpectTrue } from 'typescript-type-utils';
import { DisposeFunction, Environment, IRunOptions, RUN_OPTIONS, Universal, AsyncApi } from '../../src';
import { Config, Feature, Registry, Running, RunningFeatures, RuntimeEngine, Service, Slot } from '../../src';
import { typeCheck } from '../type-check';

/*************** EXAMPLE FEATURE FILES ***************/

const MAIN = new Environment('main', 'window', 'single');
const MAIN_1 = new Environment('main1', 'window', 'single');

const logger = new Feature({
    id: 'logger',
    api: {
        config: Config.withType<{ time: number }>().defineEntity({ time: 1 }),
        transport: Slot.withType<{ transportName: string }>().defineEntity(MAIN),
        sink: Service.withType<{ log: (message: string) => void }>().defineEntity(MAIN).allowRemoteAccess(),
    },
});
typeCheck(
    (
        _runningFeature: EQUAL<
            Running<typeof logger, 'main'>,
            {
                config: { time: number };
                transport: Registry<{
                    transportName: string;
                }>;
                sink: {
                    log: (message: string) => void;
                };
            }
        >
    ) => true
);

typeCheck(
    (
        _runningFeature: EQUAL<
            Running<typeof logger, 'zag'>,
            {
                config: { time: number };

                sink: AsyncApi<{
                    log: (message: string) => void;
                }>;
            }
        >
    ) => true
);
/* ------------------------------------------------- */

const gui = new Feature({
    id: 'gui',
    dependencies: [logger],
    api: {
        panelSlot: Slot.withType<{ panelID: string }>().defineEntity([MAIN]),
        guiService: Service.withType<{ someMethod(): void }>().defineEntity([MAIN, MAIN_1]),
    },
});

typeCheck(
    (
        _runningDependencies: EQUAL<
            RunningFeatures<typeof gui['dependencies'], 'main'>,
            { logger: Running<typeof logger, 'main'> }
        >,
        _runningFeature: EQUAL<
            Running<typeof gui, 'main'>,
            { panelSlot: Registry<{ panelID: string }>; guiService: { someMethod(): void } }
        >
    ) => true
);

/* ------------------------------------------------- */

interface DataService {
    setData: (data: unknown) => unknown;
}

interface ComponentDescription {
    component: string;
    description: string;
}

const addPanel = new Feature({
    id: 'addPanel',
    dependencies: [gui, logger],
    api: {
        componentDescription: Slot.withType<ComponentDescription>().defineEntity(MAIN),
        service1: Service.withType<DataService>().defineEntity(MAIN),
        service2: Service.withType<DataService>().defineEntity(MAIN_1),
        service3: Service.withType<DataService>().defineEntity(Universal),
    },
});
typeCheck(
    (
        _runningFeature: EQUAL<
            Running<typeof addPanel, 'main'>,
            {
                componentDescription: Registry<ComponentDescription>;
                service1: DataService;
                service3: DataService;
            }
        >,
        _runningDependencies: EQUAL<
            RunningFeatures<typeof addPanel['dependencies'], 'main'>,
            {
                logger: Running<typeof logger, 'main'>;
                gui: Running<typeof gui, 'main'>;
            }
        >,
        _: true
    ) => true
);

/*************** EXAMPLE SETUP FILES ***************/
export async function dontRun() {
    addPanel.setup(MAIN, (feature, engine) => {
        feature.componentDescription.register({ component: '', description: '' });
        feature.componentDescription.register({ component: '', description: '' });

        engine.logger.transport.register({ transportName: `test${engine.logger.config.time}` });

        engine.gui.panelSlot.register({ panelID: 'panel1' });
        engine.gui.panelSlot.register({ panelID: 'panel2' });

        engine.gui.guiService.someMethod();

        const dataPromise = fetch('./some-data');

        const service1 = {
            setData: (data: unknown) => data,
        };

        feature.run(async () => {
            service1.setData(await dataPromise);
        });

        typeCheck(
            (
                _featureTest: ExpectTrue<
                    EQUAL<
                        typeof feature,
                        {
                            id: 'addPanel';
                            run: (fn: () => unknown) => void;
                            onDispose: (fn: DisposeFunction) => void;
                            [RUN_OPTIONS]: IRunOptions;
                            componentDescription: Registry<ComponentDescription>;
                            service3: DataService;
                        }
                    >
                >
            ) => true
        );

        typeCheck(
            (
                _engineTest: EQUAL<
                    typeof engine,
                    {
                        gui: Running<typeof gui, 'main'>;
                        logger: Running<typeof logger, 'main'>;
                    }
                >,
                _: true
            ) => true
        );

        return {
            service1,
        };
    });

    await new RuntimeEngine([]).run(addPanel, 'main');
}
