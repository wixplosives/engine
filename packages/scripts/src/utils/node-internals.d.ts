declare namespace NodeJS {
    namespace Module {
        function _resolveFilename(
            request: string,
            params: {
                id: string;
                filename: string;
                paths: string[];
            }
        ): string;

        function _nodeModulePaths(directory: string): string[];
    }
}
