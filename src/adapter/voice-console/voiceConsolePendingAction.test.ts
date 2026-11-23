import {
  type PreparedVoiceAction,
  VoiceConsolePendingActionStore,
} from './voiceConsolePendingAction';

const makeAction = (
  actionId: string,
  requestPath = '/api/triage',
): PreparedVoiceAction => ({
  actionId,
  requestPath,
  body: { pjcode: 'umino', action: 'set_status', actionId },
  readBack: 'Awaiting Workspace に移動し、コメント ok を付けます。',
  removesFromQueue: true,
});

describe('VoiceConsolePendingActionStore', () => {
  it('reports no_pending_action when confirm is called with nothing prepared', () => {
    const store = new VoiceConsolePendingActionStore();

    expect(store.current()).toBeNull();
    expect(store.confirm('action-1', 'はい')).toEqual({
      ok: false,
      error: 'no_pending_action',
    });
  });

  it('confirms the prepared action once with 「はい」 and clears it afterwards', () => {
    const store = new VoiceConsolePendingActionStore();
    const action = makeAction('action-1');
    store.prepare(action);

    expect(store.current()).toEqual(action);
    expect(store.confirm('action-1', 'はい')).toEqual({ ok: true, action });
    expect(store.current()).toBeNull();
    expect(store.confirm('action-1', 'はい')).toEqual({
      ok: false,
      error: 'no_pending_action',
    });
  });

  it('accepts owner replies that are 「はい」 after trimming whitespace', () => {
    const replies = [' はい', 'はい ', '\nはい\n', '\t はい \t'];

    for (const reply of replies) {
      const store = new VoiceConsolePendingActionStore();
      const action = makeAction('action-1');
      store.prepare(action);

      expect({ reply, result: store.confirm('action-1', reply) }).toEqual({
        reply,
        result: { ok: true, action },
      });
    }
  });

  it('rejects a different action id and keeps the pending action', () => {
    const store = new VoiceConsolePendingActionStore();
    const action = makeAction('action-1');
    store.prepare(action);

    const cases = [{ actionId: 'action-2' }, { actionId: '' }];
    for (const testCase of cases) {
      expect(store.confirm(testCase.actionId, 'はい')).toEqual({
        ok: false,
        error: 'action_id_mismatch',
      });
      expect(store.current()).toEqual(action);
    }
  });

  it('rejects owner replies other than 「はい」 and keeps the pending action', () => {
    const cases = [
      { reply: 'うん' },
      { reply: '' },
      { reply: '   ' },
      { reply: 'はい。' },
      { reply: 'はいはい' },
      { reply: 'yes' },
      { reply: '送って' },
    ];

    for (const testCase of cases) {
      const store = new VoiceConsolePendingActionStore();
      const action = makeAction('action-1');
      store.prepare(action);

      expect({
        reply: testCase.reply,
        result: store.confirm('action-1', testCase.reply),
      }).toEqual({
        reply: testCase.reply,
        result: { ok: false, error: 'owner_reply_not_yes' },
      });
      expect(store.current()).toEqual(action);
    }
  });

  it('replaces a previous pending action when a new one is prepared', () => {
    const store = new VoiceConsolePendingActionStore();
    const first = makeAction('action-1');
    const second = makeAction('action-2', '/api/comment');
    store.prepare(first);
    store.prepare(second);

    expect(store.current()).toEqual(second);
    expect(store.confirm('action-1', 'はい')).toEqual({
      ok: false,
      error: 'action_id_mismatch',
    });
    expect(store.confirm('action-2', 'はい')).toEqual({
      ok: true,
      action: second,
    });
  });

  it('clears the pending action on cancel so a later confirm finds nothing', () => {
    const store = new VoiceConsolePendingActionStore();
    store.prepare(makeAction('action-1'));

    store.cancel();

    expect(store.current()).toBeNull();
    expect(store.confirm('action-1', 'はい')).toEqual({
      ok: false,
      error: 'no_pending_action',
    });
  });
});
