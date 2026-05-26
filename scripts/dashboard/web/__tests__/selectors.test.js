import { describe, it, expect } from 'vitest';
import {
  pickLatestPrompt,
  pickLatestResponse,
  pickCurrentTool,
  pickActiveSubagent,
  pickBlockedFlag,
  pickIsAwaitingUser,
} from '../src/selectors/activity.js';

const ts = '2026-04-30T00:00:00.000Z';

// U7
describe('pickLatestPrompt', () => {
  it('1 UserPromptSubmit: return text and ts', () => {
    const activity = [
      { ts, type: 'UserPromptSubmit', data: { payload: { prompt: 'hello world' } } },
    ];
    const result = pickLatestPrompt(activity);
    expect(result).not.toBeNull();
    expect(result.text).toBe('hello world');
    expect(result.ts).toBe(ts);
  });

  it('Process user_prompt field also', () => {
    const activity = [
      { ts, type: 'UserPromptSubmit', data: { payload: { user_prompt: 'hi there' } } },
    ];
    const result = pickLatestPrompt(activity);
    expect(result?.text).toBe('hi there');
  });

  it('truncate + ellipsis when exceeding 80 characters', () => {
    const long = 'a'.repeat(85);
    const activity = [
      { ts, type: 'UserPromptSubmit', data: { payload: { prompt: long } } },
    ];
    const result = pickLatestPrompt(activity);
    expect(result?.text.length).toBe(80);
    expect(result?.text.endsWith('…')).toBe(true);
  });

  // U8
  it('No UserPromptSubmit: returns null', () => {
    const activity = [
      { ts, type: 'PreToolUse', data: { payload: { tool_name: 'Bash' } } },
    ];
    expect(pickLatestPrompt(activity)).toBeNull();
  });

  it('Empty array: returns null', () => {
    expect(pickLatestPrompt([])).toBeNull();
  });
});

// U9, U10
describe('pickCurrentTool', () => {
  it('No PostToolUse after PreToolUse: return tool in progress', () => {
    const activity = [
      { ts, type: 'PreToolUse', data: { payload: { tool_name: 'Bash' } } },
    ];
    const result = pickCurrentTool(activity);
    expect(result).not.toBeNull();
    expect(result.name).toBe('Bash');
  });

  it('PreToolUse + PostToolUse matching: return null', () => {
    const activity = [
      { ts, type: 'PreToolUse', data: { payload: { tool_name: 'Bash' } } },
      { ts, type: 'PostToolUse', data: { payload: { tool_name: 'Bash' } } },
    ];
    expect(pickCurrentTool(activity)).toBeNull();
  });

  it('If only the second PreToolUse is in progress', () => {
    const activity = [
      { ts, type: 'PreToolUse', data: { payload: { tool_name: 'Read' } } },
      { ts, type: 'PostToolUse', data: { payload: { tool_name: 'Read' } } },
      { ts, type: 'PreToolUse', data: { payload: { tool_name: 'Bash' } } },
    ];
    const result = pickCurrentTool(activity);
    expect(result?.name).toBe('Bash');
  });
});

// U11
describe('pickBlockedFlag', () => {
  it('Notification includes "permission": true', () => {
    const activity = [
      {
        ts,
        type: 'Notification',
        data: { payload: { message: 'permission required' } },
      },
    ];
    expect(pickBlockedFlag(activity)).toBe(true);
  });

  it('Notification includes "blocked": true', () => {
    const activity = [
      {
        ts,
        type: 'Notification',
        data: { payload: { message: 'action blocked by policy' } },
      },
    ];
    expect(pickBlockedFlag(activity)).toBe(true);
  });

  it('No Notification: false', () => {
    const activity = [
      { ts, type: 'PreToolUse', data: { payload: { tool_name: 'Bash' } } },
    ];
    expect(pickBlockedFlag(activity)).toBe(false);
  });
});

describe('pickActiveSubagent', () => {
  it('SubagentStop is the last stop event: true', () => {
    const activity = [
      { ts, type: 'SubagentStop', data: {} },
    ];
    expect(pickActiveSubagent(activity)).toBe(true);
  });

  it('Stop is the last stop event: false', () => {
    const activity = [
      { ts, type: 'SubagentStop', data: {} },
      { ts, type: 'Stop', data: {} },
    ];
    expect(pickActiveSubagent(activity)).toBe(false);
  });

  it('No stop event: false', () => {
    const activity = [
      { ts, type: 'PreToolUse', data: { payload: { tool_name: 'Bash' } } },
    ];
    expect(pickActiveSubagent(activity)).toBe(false);
  });

  it('SessionEnd after SubagentStop: false (Session termination also terminates the sub-agent)', () => {
    const activity = [
      { ts, type: 'SubagentStop', data: {} },
      { ts, type: 'SessionEnd', data: {} },
    ];
    expect(pickActiveSubagent(activity)).toBe(false);
  });
});

describe('pickLatestResponse', () => {
  const mkResp = (type, t, text) => ({
    ts: t,
    type,
    data: { payload: { lastAssistantText: text } },
  });

  it('Return lastAssistantText from Stop event', () => {
    const activity = [mkResp('Stop', ts, 'hello world')];
    const r = pickLatestResponse(activity);
    expect(r?.text).toBe('hello world');
    expect(r?.stale).toBeFalsy();
  });

  it("Also adopts PostToolUse's lastAssistantText (mid-turn response)", () => {
    const activity = [
      mkResp('Stop', '2026-04-30T00:00:00.000Z', 'old turn'),
      { ts: '2026-04-30T00:00:01.000Z', type: 'UserPromptSubmit', data: { payload: { prompt: 'next' } } },
      mkResp('PostToolUse', '2026-04-30T00:00:02.000Z', 'mid-turn text'),
    ];
    const r = pickLatestResponse(activity);
    expect(r?.text).toBe('mid-turn text');
    expect(r?.stale).toBeFalsy();
  });

  it('UserPromptSubmit since last response: stale=true', () => {
    const activity = [
      mkResp('Stop', '2026-04-30T00:00:00.000Z', 'previous reply'),
      { ts: '2026-04-30T00:00:05.000Z', type: 'UserPromptSubmit', data: { payload: { prompt: 'next q' } } },
    ];
    const r = pickLatestResponse(activity);
    expect(r?.text).toBe('previous reply');
    expect(r?.stale).toBe(true);
  });

  it('No response event: null', () => {
    const activity = [
      { ts, type: 'PreToolUse', data: { payload: { tool_name: 'Bash' } } },
    ];
    expect(pickLatestResponse(activity)).toBeNull();
  });

  it('Skip PostToolUse without lastAssistantText and adopt further past Stop', () => {
    const activity = [
      mkResp('Stop', '2026-04-30T00:00:00.000Z', 'real reply'),
      { ts: '2026-04-30T00:00:01.000Z', type: 'PostToolUse', data: { payload: { tool_name: 'Bash' } } },
    ];
    const r = pickLatestResponse(activity);
    expect(r?.text).toBe('real reply');
  });
});

describe('pickIsAwaitingUser', () => {
  const promptTs = '2026-04-30T00:00:00.000Z';
  const promptMs = Date.parse(promptTs);
  const prompt = { ts: promptTs, type: 'UserPromptSubmit', data: { payload: { prompt: 'go' } } };

  function notif(message, offsetMs) {
    return {
      ts: new Date(promptMs + offsetMs).toISOString(),
      type: 'Notification',
      data: { payload: { message } },
    };
  }

  it('busy status + permission notification is last → true', () => {
    const activity = [prompt, notif('Claude needs your permission to use Bash', 100)];
    expect(pickIsAwaitingUser(activity, null)).toBe(true);
  });

  it('Also recognize input/waiting keywords', () => {
    expect(pickIsAwaitingUser([prompt, notif('waiting for your input', 100)], null)).toBe(true);
  });

  it('If another hook falls after Notification, release → false', () => {
    const activity = [
      prompt,
      notif('Claude needs your permission to use Bash', 100),
      { ts: new Date(promptMs + 200).toISOString(), type: 'PreToolUse', data: { payload: { tool_name: 'Bash' } } },
    ];
    expect(pickIsAwaitingUser(activity, null)).toBe(false);
  });

  it('No Notification → false', () => {
    const activity = [
      prompt,
      { ts: new Date(promptMs + 100).toISOString(), type: 'PreToolUse', data: { payload: { tool_name: 'Edit' } } },
    ];
    expect(pickIsAwaitingUser(activity, null)).toBe(false);
  });

  it('Irrelevant Notification message → false', () => {
    expect(pickIsAwaitingUser([prompt, notif('build finished', 100)], null)).toBe(false);
  });

  it('Not busy (Stop is final) → false', () => {
    const activity = [
      prompt,
      notif('Claude needs your permission to use Bash', 100),
      { ts: new Date(promptMs + 200).toISOString(), type: 'Stop', data: {} },
    ];
    expect(pickIsAwaitingUser(activity, null)).toBe(false);
  });
});
