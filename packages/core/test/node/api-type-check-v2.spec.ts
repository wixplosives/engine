import type { EQUAL, ExpectTrue } from 'typescript-type-utils';
import {
    DisposeFunction,
    Environment,
    IRunOptions,
    RUN_OPTIONS,
    Universal,
    AsyncApi,
    Config,
    Registry,
    Running,
    RuntimeEngine,
    Service,
    Slot,
    ENGINE,
    RunningFeatures,
    setup,
} from '@wixc3/engine-core';
import { typeCheck } from '../type-check';

/*************** EXAMPLE FEATURE FILES ***************/

const MAIN = new Environment('main', 'window', 'single');
const ZAG = new Environment('zag', 'window', 'single');
const MAIN_1 = new Environment('main1', 'window', 'single');

class Logger {
    static id = 'logger' as const;
    static api = {
        config: Config.withType<{ time: number }>().defineEntity({ time: 1 }),
        transport: Slot.withType<{ transportName: string }>().defineEntity(MAIN),
        sink: Service.withType<{ log: (message: string) => void }>().defineEntity(MAIN).allowRemoteAccess(),
    };
    static dependencies = [];
}

// const logger = new Feature({
//     id: 'logger',
//     api: {
//         config: Config.withType<{ time: number }>().defineEntity({ time: 1 }),
//         transport: Slot.withType<{ transportName: string }>().defineEntity(MAIN),
//         sink: Service.withType<{ log: (message: string) => void }>().defineEntity(MAIN).allowRemoteAccess(),
//     },
// });
typeCheck(
    (
        _runningFeature: EQUAL<
            Running<typeof Logger, typeof MAIN>,
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
            Running<typeof Logger, typeof ZAG>,
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

class GUI {
    static id = 'gui' as const;
    static api = {
        panelSlot: Slot.withType<{ panelID: string }>().defineEntity([MAIN]),
        guiService: Service.withType<{ someMethod(): void }>().defineEntity([MAIN, MAIN_1]),
    };
    static dependencies = [Logger];
}

interface SomeApi {
    someMethod: () => boolean;
}

type SomeApiPromisified = AsyncApi<SomeApi>;

typeCheck((_: EQUAL<SomeApiPromisified, { someMethod(): Promise<boolean> }>) => true);
typeCheck(
    (
        _runningDependencies: EQUAL<
            RunningFeatures<typeof GUI['dependencies'], typeof MAIN>,
            { logger: Running<typeof Logger, typeof MAIN> }
        >,
        _runningFeature: EQUAL<
            Running<typeof GUI, typeof MAIN>,
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

class AddPanel {
    static id = 'addPanel' as const;
    static api = {
        componentDescription: Slot.withType<ComponentDescription>().defineEntity(MAIN),
        service1: Service.withType<DataService>().defineEntity(MAIN),
        service2: Service.withType<DataService>().defineEntity(MAIN_1),
        service3: Service.withType<DataService>().defineEntity(Universal),
    } as const;
    static dependencies = [GUI, Logger] as const;
}

typeCheck(
    (
        _runningFeature: EQUAL<
            Running<typeof AddPanel, typeof MAIN>,
            {
                componentDescription: Registry<ComponentDescription>;
                service1: DataService;
                service3: DataService;
            }
        >,
        _runningDependencies: EQUAL<
            RunningFeatures<typeof AddPanel['dependencies'], typeof MAIN>,
            {
                logger: Running<typeof Logger, typeof MAIN>;
                gui: Running<typeof GUI, typeof MAIN>;
            }
        >,
        _: true
    ) => true
);

const env = new Environment('main', 'window', 'single');

/*************** EXAMPLE SETUP FILES ***************/
export async function dontRun() {
    setup(AddPanel, MAIN, (feature, features) => {
        feature.componentDescription.register({ component: '', description: '' });
        feature.componentDescription.register({ component: '', description: '' });
        features.logger.transport.register({ transportName: `test${features.logger.config.time}` });

        features.gui.panelSlot.register({ panelID: 'panel1' });
        features.gui.panelSlot.register({ panelID: 'panel2' });

        features.gui.guiService.someMethod();

        const dataPromise = fetch('./some-data');

        const service1 = {
            setData: (data: unknown) => data,
        };

        feature.run(async () => {
            service1.setData(await dataPromise);
        });

        const engine = feature[ENGINE];

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
                            [ENGINE]: typeof engine;
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
                    typeof features,
                    {
                        gui: Running<typeof GUI, typeof MAIN>;
                        logger: Running<typeof Logger, typeof MAIN>;
                    }
                >,
                _: true
            ) => true
        );

        return {
            service1,
        };
    });

    await new RuntimeEngine(env, []).run(AddPanel);
}
