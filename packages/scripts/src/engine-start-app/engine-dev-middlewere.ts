import { Router } from 'express';
import { IFeatureTarget } from '../application';
import { IFeatureTableProps } from './features-table';
import { getMainPage } from './main-page';
export function engineDevMiddleware(
    runningEntities: IFeatureTableProps,
    runFeature: ({
        featureName,
        configName,
        projectPath
    }: IFeatureTarget) => Promise<{
        close: () => Promise<void>;
    }>,
    projectPath: string = process.cwd()
) {
    const router = Router();

    router.get('/', async (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(getMainPage(runningEntities));
    });

    return router;
}
