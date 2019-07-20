import rimrafCb from 'rimraf';
import { promisify } from 'util';

export const rimraf = promisify(rimrafCb);
