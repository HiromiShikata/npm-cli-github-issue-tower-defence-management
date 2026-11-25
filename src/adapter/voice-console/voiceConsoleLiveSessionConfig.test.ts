import {
  VOICE_CONSOLE_BACKEND_NOTE,
  VOICE_CONSOLE_LIVE_INSTRUCTIONS,
} from './voiceConsoleLiveSessionConfig';

describe('VOICE_CONSOLE_LIVE_INSTRUCTIONS', () => {
  it('is a non-empty voice-role text that tells GPT-Live to speak at the fastest clear pace', () => {
    expect({
      nonEmpty: VOICE_CONSOLE_LIVE_INSTRUCTIONS.length > 0,
      mentionsFastestPace:
        VOICE_CONSOLE_LIVE_INSTRUCTIONS.includes('最も速いペース'),
    }).toEqual({ nonEmpty: true, mentionsFastestPace: true });
  });

  it('tells GPT-Live to speak the backend results faithfully and to read decisions with their options in full', () => {
    const cases = [{ word: '結果' }, { word: '判断' }, { word: '選択肢' }];

    for (const testCase of cases) {
      expect({
        word: testCase.word,
        mentioned: VOICE_CONSOLE_LIVE_INSTRUCTIONS.includes(testCase.word),
      }).toEqual({ word: testCase.word, mentioned: true });
    }
  });

  it('tells GPT-Live never to invent answers', () => {
    const cases = [{ word: '作' }, { word: '推測' }];

    expect(
      cases.some((testCase) =>
        VOICE_CONSOLE_LIVE_INSTRUCTIONS.includes(testCase.word),
      ),
    ).toBe(true);
  });
});

describe('VOICE_CONSOLE_BACKEND_NOTE', () => {
  it('tells Claude that the owner is speaking through GPT-Live', () => {
    expect({
      mentionsGptLive: VOICE_CONSOLE_BACKEND_NOTE.includes('GPT-Live'),
      mentionsVoice: VOICE_CONSOLE_BACKEND_NOTE.includes('音声'),
    }).toEqual({ mentionsGptLive: true, mentionsVoice: true });
  });

  it('asks for concise, speakable Japanese with no markdown and no URLs read aloud', () => {
    const cases = [
      { word: '簡潔' },
      { word: '日本語' },
      { word: 'Markdown' },
      { word: 'URL' },
    ];

    for (const testCase of cases) {
      expect({
        word: testCase.word,
        mentioned: VOICE_CONSOLE_BACKEND_NOTE.includes(testCase.word),
      }).toEqual({ word: testCase.word, mentioned: true });
    }
  });
});
