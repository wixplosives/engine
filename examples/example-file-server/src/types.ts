export interface IDirectoryContents {
    [key: string]: IDirectoryContents | FileData;
}

export interface FileData {
    filePath: string;
    fileName: string;
}
