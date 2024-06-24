import { expect } from 'chai';
import { getEngineEntryOptions } from '@wixc3/engine-core';

describe('helpers', () => {
  describe('getEngineEntryOptions', () => {
    it('it gets engine entry options from query string, from script url, from engineEntryOptions', () => {
      const document = { currentScript: { dataset: { engineRunOptions: 'http://localhost:3000?one=0&two=1&script=123' } } } as unknown as Document;
      const location = { search: 'one=2&two=2&search=123' } as Location;
      const engineEntryOptions = ({ envName }: { envName: string }) => {
        if (envName === 'thisTest') {
          return new URLSearchParams([['injected', '123'], ['one', '1']]);
        }
        return new URLSearchParams();
      };
      const result = getEngineEntryOptions('thisTest', { document, location, engineEntryOptions });

      expect(result.get('one'), 'Priorities injected options over search string and script url').to.eql('1');
      expect(result.get('two'), 'Priorities search params over script url').to.eql('2');
      expect(result.get('script'), 'Gets options from script url').to.eql('123');
      expect(result.get('search'), 'Gets options from search string').to.eql('123');
      expect(result.get('injected'), 'Gets options from engineEntryOptions').to.eql('123');
    });
  });
});

