import '@testing-library/jest-dom';

// There is no ResizeObserver in jsdom. @xyflow/react uses it when mounting, so polyfill.
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// SVGElement.getBBox mock — called internally by React Flow
if (typeof SVGElement !== 'undefined' && !SVGElement.prototype.getBBox) {
  SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
}
