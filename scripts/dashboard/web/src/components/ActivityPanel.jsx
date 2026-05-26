import React from 'react';
import {
  pickLatestPrompt,
  pickLatestResponse,
  pickCurrentTool,
  pickActiveSubagent,
} from '../selectors/activity.js';

const EMPTY = '—';

/**
 * Agent activity panel at the bottom of the card.
 * Display four derived views from the activity array.
 *
 * @param {{ activity: Array<{ts:string,type:string,data:unknown}> }} props
 */
export default function ActivityPanel({ activity = [], fallback = null }) {
  const latestPrompt = pickLatestPrompt(activity, fallback?.lastPromptEvent);
  const latestResponse = pickLatestResponse(activity, fallback?.lastStopEvent);
  const currentTool = pickCurrentTool(activity);
  const hasSubagent = pickActiveSubagent(activity);

  const toolName = currentTool?.name ?? EMPTY;
  const promptText = latestPrompt?.text ?? EMPTY;
  const responseText = latestResponse?.text ?? EMPTY;
  const subagentValue = hasSubagent ? 'active' : EMPTY;

  return (
    <div className="activity-panel">
      <div className="activity-panel__title">Activity</div>
      <dl className="activity-panel__rows">
        <div className="activity-panel__row">
          <dt>Last prompt</dt>
          <dd
            key={promptText}
            className="activity-panel__prompt"
            title={promptText}
          >
            {promptText}
          </dd>
        </div>
        <div className="activity-panel__row">
          <dt>Last response</dt>
          <dd
            key={responseText + (latestResponse?.stale ? ':stale' : '')}
            className={
              'activity-panel__prompt'
              + (latestResponse?.stale ? ' activity-panel__prompt--stale' : '')
            }
            title={latestResponse?.text ?? ''}
          >
            {latestResponse?.stale ? 'Waiting for response... ' : ''}{responseText}
          </dd>
        </div>
        <div className="activity-panel__row">
          <dt>Current tool</dt>
          <dd key={toolName}>
            {currentTool?.name != null && (
              <span className="activity-panel__spinner" aria-hidden="true" />
            )}
            {toolName}
          </dd>
        </div>
        <div className="activity-panel__row">
          <dt>Sub-agent</dt>
          <dd key={subagentValue}>
            {hasSubagent
              ? (
                <span className="activity-panel__subagent--active">
                  <span className="activity-panel__pulse-dot" aria-hidden="true" />
                  {subagentValue}
                </span>
              )
              : subagentValue}
          </dd>
        </div>
      </dl>
    </div>
  );
}
