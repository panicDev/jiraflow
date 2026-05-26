/**
 * edgeTypes unit tests (MAE-264)
 *
 * Mock BezierEdge to verify that each edge component delivers expected props.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// BezierEdge mock: Capture the received props
let capturedProps = {};
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    BezierEdge: (props) => {
      capturedProps = props;
      return null;
    },
  };
});

const { BlocksEdge, ParentEdge, EpicEdge } = await import(
  '../src/components/graph/edgeTypes.jsx'
);

/** Returns props passed to BezierEdge after rendering */
function renderEdge(Component, extraProps = {}) {
  capturedProps = {};
  render(
    <Component
      id="e1"
      source="n1"
      target="n2"
      sourceX={0}
      sourceY={0}
      targetX={100}
      targetY={100}
      {...extraProps}
    />
  );
  return capturedProps;
}

describe('BlocksEdge (MAE-264)', () => {
  it('stroke color is #dc2626 (red-600)', () => {
    const props = renderEdge(BlocksEdge);
    expect(props.style?.stroke).toBe('#dc2626');
  });

  it('label prop is "blocks"', () => {
    const props = renderEdge(BlocksEdge);
    expect(props.label).toBe('blocks');
  });

  it('labelBgStyle.fill is set', () => {
    const props = renderEdge(BlocksEdge);
    expect(props.labelBgStyle?.fill).toBeTruthy();
  });
});

describe('ParentEdge (MAE-264)', () => {
  it('stroke color is #64748b (slate-500)', () => {
    const props = renderEdge(ParentEdge);
    expect(props.style?.stroke).toBe('#64748b');
  });

  it('label prop is "parent"', () => {
    const props = renderEdge(ParentEdge);
    expect(props.label).toBe('parent');
  });
});

describe('EpicEdge (MAE-264)', () => {
  it('stroke color is #9333ea (purple-600)', () => {
    const props = renderEdge(EpicEdge);
    expect(props.style?.stroke).toBe('#9333ea');
  });

  it('label prop is "epic"', () => {
    const props = renderEdge(EpicEdge);
    expect(props.label).toBe('epic');
  });
});

describe('Common (MAE-264)', () => {
  it('BlocksEdge: If there is a label prop passed externally, it will be overwritten', () => {
    // Label is hardcoded, so always "blocks" — external labels are overwritten
    const props = renderEdge(BlocksEdge, { label: 'custom' });
    expect(props.label).toBe('blocks');
  });

  it('BlocksEdge: labelStyle.fontSize is 11', () => {
    const props = renderEdge(BlocksEdge);
    expect(props.labelStyle?.fontSize).toBe(11);
  });

  it('BlocksEdge: labelBgPadding is [6,3]', () => {
    const props = renderEdge(BlocksEdge);
    expect(props.labelBgPadding).toEqual([6, 3]);
  });

  it('BlocksEdge: labelBgBorderRadius is 4', () => {
    const props = renderEdge(BlocksEdge);
    expect(props.labelBgBorderRadius).toBe(4);
  });
});
