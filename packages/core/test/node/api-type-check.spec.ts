import { EQUAL, ExpectTrue } from 'typescript-type-utils';
import { DisposeFunction, Environment, Universal } from '../../src';
import {
    Config,
    Feature,
    Registry,
    Running,
    RunningFeatures,
    RuntimeEngine,
    Service,
    Slot,
    type_check
} from '../../src';

/*************** EXAMPLE FEATURE FILES ***************/

const MAIN = new Environment('main');
const MAIN_1 = new Environment('main1');

const logger = new Feature({
    id: 'logger',
    api: {
        config: Config.withType<{ time: number }>().defineEntity({ time: 1 }),
        transport: Slot.withType<{ transportName: string }>().defineEntity(MAIN)
    }
});

type_check(
    (
        _runningFeature: EQUAL<
            Running<typeof logger, 'main'>,
            { config: { time: number }; transport: Registry<{ transportName: string }> }
        >
    ) => true
);

/* ------------------------------------------------- */

const gui = new Feature({
    id: 'gui',
    dependencies: [logger],
    api: {
        panelSlot: Slot.withType<{ panelID: string }>().defineEntity([MAIN]),
        guiService: Service.withType<{ someMethod(): void }>().defineEntity([MAIN, MAIN_1])
    }
});

type_check(
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
        service3: Service.withType<DataService>().defineEntity(Universal)
    }
});
type_check(
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
export function dontRun() {
    addPanel.setup(MAIN, (feature, engine) => {
        feature.componentDescription.register({ component: '', description: '' });
        feature.componentDescription.register({ component: '', description: '' });

        engine.logger.transport.register({ transportName: 'test' + engine.logger.config.time });

        engine.gui.panelSlot.register({ panelID: 'panel1' });
        engine.gui.panelSlot.register({ panelID: 'panel2' });

        engine.gui.guiService.someMethod();

        const dataPromise = fetch('./some-data');

        const service1 = {
            setData: (data: unknown) => data
        };

        feature.run(async () => {
            service1.setData(await dataPromise);
        });

        type_check(
            (
                _featureTest: ExpectTrue<
                    EQUAL<
                        typeof feature,
                        {
                            id: 'addPanel';
                            run: (fn: () => unknown) => void;
                            onDispose: (fn: DisposeFunction) => void;
                            componentDescription: Registry<ComponentDescription>;
                            service3: DataService;
                            // service2: DataService
                        }
                    >
                >
            ) => true
        );

        type_check(
            (
                _engineTest: EQUAL<
                    typeof engine,
                    {
                        gui: Running<typeof gui, 'main' | 'main1'>;
                        logger: Running<typeof logger, 'main' | 'main1'>;
                    }
                >,
                _: true
            ) => true
        );

        return {
            service1
        };
    });

    new RuntimeEngine([]).run(addPanel);
}
