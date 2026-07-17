import { parseActivationResponse } from '../../lib/utils';

/**
 * ADT signals a clean activation with HTTP 200 and an empty body. The
 * chkl:messages block is only sent when there is something to report, so an
 * empty body must not be read as "nothing was activated".
 */
describe('parseActivationResponse', () => {
  describe('clean activation (empty body)', () => {
    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['newline only', '\n'],
      ['undefined body', undefined],
      ['null body', null],
    ])('treats %s as a successful activation', (_label, body) => {
      const result = parseActivationResponse(body);

      expect(result.activated).toBe(true);
      expect(result.checked).toBe(true);
      expect(result.messages).toEqual([]);
    });

    it('yields success under the handlers’ activated && checked formula', () => {
      const result = parseActivationResponse('');

      expect(result.activated && result.checked).toBe(true);
    });
  });

  describe('activation with messages', () => {
    it('reads the executed flags from chkl:properties', () => {
      const body = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties activationExecuted="true" checkExecuted="true" generationExecuted="true"/>
</chkl:messages>`;

      const result = parseActivationResponse(body);

      expect(result.activated).toBe(true);
      expect(result.checked).toBe(true);
      expect(result.generated).toBe(true);
    });

    it('reports a failed activation as not activated', () => {
      const body = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties activationExecuted="false" checkExecuted="true"/>
  <msg type="error" line="12"><shortText><txt>Syntax error</txt></shortText></msg>
</chkl:messages>`;

      const result = parseActivationResponse(body);

      expect(result.activated).toBe(false);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toMatchObject({
        type: 'error',
        text: 'Syntax error',
      });
    });

    it('collects multiple messages', () => {
      const body = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties activationExecuted="true" checkExecuted="true"/>
  <msg type="warning"><shortText><txt>Unused variable</txt></shortText></msg>
  <msg type="warning"><shortText><txt>Obsolete statement</txt></shortText></msg>
</chkl:messages>`;

      const result = parseActivationResponse(body);

      expect(result.activated).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages.map((m) => m.type)).toEqual([
        'warning',
        'warning',
      ]);
    });
  });
});
