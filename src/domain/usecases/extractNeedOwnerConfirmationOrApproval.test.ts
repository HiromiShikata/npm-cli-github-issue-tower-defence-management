import { extractNeedOwnerConfirmationOrApproval } from './extractNeedOwnerConfirmationOrApproval';

describe('extractNeedOwnerConfirmationOrApproval', () => {
  it('returns true when needOwnerConfirmationOrApproval is true in a fenced json block', () => {
    expect(
      extractNeedOwnerConfirmationOrApproval(
        'From: :robot: agent (model)\n\n```json\n{ "needOwnerConfirmationOrApproval": true }\n```\n',
      ),
    ).toBe(true);
  });

  it('returns true when the code fence backticks are backslash escaped', () => {
    expect(
      extractNeedOwnerConfirmationOrApproval(
        'From: :robot: agent (model)\n\n\\`\\`\\`json\n{ "needOwnerConfirmationOrApproval": true }\n\\`\\`\\`\n',
      ),
    ).toBe(true);
  });

  it('returns true when the report body uses CRLF line endings', () => {
    expect(
      extractNeedOwnerConfirmationOrApproval(
        'From: :robot: agent (model)\r\n\r\n```json\r\n{ "needOwnerConfirmationOrApproval": true }\r\n```\r\n',
      ),
    ).toBe(true);
  });

  it('returns false when the field is false', () => {
    expect(
      extractNeedOwnerConfirmationOrApproval(
        'From: :robot: agent (model)\n\n```json\n{ "needOwnerConfirmationOrApproval": false }\n```\n',
      ),
    ).toBe(false);
  });

  it('returns false when the field is absent', () => {
    expect(
      extractNeedOwnerConfirmationOrApproval(
        'From: :robot: agent (model)\n\n```json\n{ "nextStep": null }\n```\n',
      ),
    ).toBe(false);
  });

  it('returns false when the field is null', () => {
    expect(
      extractNeedOwnerConfirmationOrApproval(
        'From: :robot: agent (model)\n\n```json\n{ "needOwnerConfirmationOrApproval": null }\n```\n',
      ),
    ).toBe(false);
  });

  it('returns false when the body carries no fenced json block', () => {
    expect(
      extractNeedOwnerConfirmationOrApproval('Please go ahead with that.'),
    ).toBe(false);
  });

  it('returns true from a later block when the routing block is not the first fenced json block', () => {
    expect(
      extractNeedOwnerConfirmationOrApproval(
        'From: :robot: agent (model)\n\n```json\n{ "context": "info" }\n```\n\n```json\n{ "needOwnerConfirmationOrApproval": true }\n```\n',
      ),
    ).toBe(true);
  });

  it('returns true and warns about unparseable earlier block', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    expect(
      extractNeedOwnerConfirmationOrApproval(
        'From: :robot: agent (model)\n\n```json\n{ "broken",\n```\n\n```json\n{ "needOwnerConfirmationOrApproval": true }\n```\n',
      ),
    ).toBe(true);
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});
