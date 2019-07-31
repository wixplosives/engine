
import { Router } from 'express';
import { getMainPage } from './main-table';
import { IFeatureTableProps } from './table';
export function engineDevMiddleware(runningEntities: IFeatureTableProps) {
    const router = Router();

    router.get('/', (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(getMainPage(runningEntities));
    });

    return router;
}
