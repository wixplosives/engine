import { RuntimeEngine } from './runtime-engine';
import { SomeFeature, TopLevelConfig } from './types';
export function run(entryFeature: SomeFeature | SomeFeature[], topLevelConfig: TopLevelConfig = []): RuntimeEngine {
    return new RuntimeEngine(topLevelConfig).run(entryFeature);
}
