export const normilaizeTestName = (testName: string) => {
    return testName.replace(/(\W+)/gi, ' ').trim().replace(/(\W+)/gi, '-');
};
