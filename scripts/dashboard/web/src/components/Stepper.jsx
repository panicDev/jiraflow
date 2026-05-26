import React, { useEffect, useRef, useState } from 'react';
import { SDLC_STEPS, getStepState } from '../constants/sdlc.js';

/**
 * Stepper component that visualizes the progress of SDLC step 9.
 * When transitioning from pending → done, the data-just-completed attribute is given 1 tick to the relevant step and
 * Fire the CSS pop-in animation only once.
 *
 * @param {{ completedSteps?: string[] | null }} props
 */
export default function Stepper({ completedSteps }) {
  const steps = Array.isArray(completedSteps) ? completedSteps : [];
  const prevStepsRef = useRef(steps);
  // Set of step IDs that just became done this render cycle
  const [justCompleted, setJustCompleted] = useState(() => new Set());

  useEffect(() => {
    const prev = prevStepsRef.current;
    const newlyDone = steps.filter(id => !prev.includes(id));
    if (newlyDone.length > 0) {
      const set = new Set(newlyDone);
      setJustCompleted(set);
      // Remove after one animation frame to allow CSS to fire exactly once
      const id = setTimeout(() => setJustCompleted(new Set()), 500);
      prevStepsRef.current = steps;
      return () => clearTimeout(id);
    }
    prevStepsRef.current = steps;
  }, [steps]);

  return (
    <ol className="wt-stepper" aria-label="SDLC progress">
      {SDLC_STEPS.map((step, idx) => {
        const state = getStepState(step.id, steps);
        const extraProps = justCompleted.has(step.id)
          ? { 'data-just-completed': '' }
          : {};
        const isLast = idx === SDLC_STEPS.length - 1;
        // Connector color: depending on the state of the next step. If the next step is done, thick flow,
        //Otherwise blurry flow. Smooth the next arrow if the current step is active.
        const nextState = isLast ? null : getStepState(SDLC_STEPS[idx + 1].id, steps);
        // skipped A dim tone that seems to cut off the flow when the step is on either side.
        const isAroundSkipped = state === 'skipped' || nextState === 'skipped';
        const connectorClass = `wt-stepper__connector wt-stepper__connector--${
          isAroundSkipped ? 'pending' :
          state === 'done' && nextState === 'done' ? 'done' :
          state === 'done' || state === 'active' ? 'active' :
          'pending'
        }`;
        return (
          <React.Fragment key={step.id}>
            <li
              className={`wt-stepper__step wt-stepper__step--${state}`}
              title={`${step.label}: ${state}`}
              aria-label={`${step.label}: ${state}`}
              {...extraProps}
            >
              {step.label}
            </li>
            {!isLast && (
              <span
                className={
                  state === 'done' && nextState === 'active'
                    ? 'wt-stepper__connector wt-stepper__connector--chase'
                    : connectorClass
                }
                aria-hidden="true"
              >
                {/* thin line + small arrowhead. In chase state, the line flows from left to right. */}
                <svg
                  className="wt-stepper__arrow"
                  viewBox="0 0 24 8"
                  preserveAspectRatio="none"
                  width="14"
                  height="8"
                >
                  <line
                    className="wt-stepper__arrow-line"
                    x1="0" y1="4" x2="20" y2="4"
                    stroke="currentColor"
                    strokeWidth="0.6"
                    strokeLinecap="round"
                  />
                  <polyline
                    className="wt-stepper__arrow-head"
                    points="17.5,2 21,4 17.5,6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
