import { BaseHost, Communication, deferred } from '@wixc3/engine-core';
import { WebContents, IpcMain, app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';

(async () => {
    class ElectronNodeHost extends BaseHost {
        constructor(private host: IpcMain, private webContents: WebContents) {
            super();
            this.host.on('message', (_, data) => {
                this.emitMessageHandlers(data);
            });
        }

        postMessage(message: any) {
            this.webContents.send('message', message);
        }
    }

    app.allowRendererProcessReuse = true;
    const mainHtmlPath = join(__dirname, '../static/main.html');
    const { promise, resolve } = deferred<BrowserWindow>();
    const createWindow = () => {
        const mainWindow = new BrowserWindow({
            width: 1024,
            height: 768,
            webPreferences: {
                nodeIntegration: true,
                nodeIntegrationInSubFrames: true,
                nodeIntegrationInWorker: true,
            },
        });
        mainWindow
            .loadFile(mainHtmlPath, {
                query: {
                    feature: 'electron-app/example',
                },
            })
            .catch(console.error);

        mainWindow.webContents.openDevTools();

        resolve(mainWindow);
    };
    app.on('ready', createWindow);

    app.on('window-all-closed', () => {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    const com = new Communication(new BaseHost(), 'electron-main');

    const mainWindow = await promise;

    const clientHost = new ElectronNodeHost(ipcMain, mainWindow.webContents);
    com.registerEnv('main', clientHost);
    com.registerMessageHandler(clientHost);
})().catch(console.error);
