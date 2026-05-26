/**
 * Define steps for SDLC visualization (Step 7).
 * `init` is excluded from the stepper because the existence of the worktree itself means init completion.
 * The `completedSteps` payload may contain init, but it is not subject to display.
 * `plan` + `design` are combined into a single `approach` step.
 *
 * @type {ReadonlyArray<{id: string, label: string}>}
 */
export const SDLC_STEPS = Object.freeze([
  { id: 'start',    label: 'start'    },
  { id: 'approach', label: 'approach' },
  { id: 'impl',     label: 'impl'     },
  { id: 'test',     label: 'test'     },
  { id: 'review',   label: 'review'   },
  { id: 'merge',    label: 'merge'    },
  { id: 'done',     label: 'done'     },
]);

/**
 * Returns the status of a specific SDLC step.
 *
 * - Steps included in completedSteps → "done"
 * - first step not in completedSteps → "active"
 * - Subsequent steps → "pending"
 *
 * @param {string} stepId - Step ID to query
 * @param {string[] | null | undefined} completedSteps - List of completed steps
 * @returns {"done" | "active" | "pending"}
 */
export function getStepState(stepId, completedSteps) {
  const completed = Array.isArray(completedSteps) ? completedSteps : [];

  // If this step has already been completed, done
  if (completed.includes(stepId)) return 'done';

  // If 'done' step is completed = end the entire workflow.
  // Mark the step as "skipped" if it itself is not in completedSteps.
  if (completed.includes('done')) return 'skipped';

  // Find the first incomplete step in SDLC_STEPS order
  const firstIncomplete = SDLC_STEPS.find(s => !completed.includes(s.id));

  // active if the first incomplete step is the current step, otherwise pending
  return firstIncomplete?.id === stepId ? 'active' : 'pending';
}
