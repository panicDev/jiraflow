import React from 'react';

/**
 * KITT style light bar at the top of the screen.
 * If SSE is connected, the blue dot scans left → right → left, and if disconnected, it is a static dim line.
 *
 * @param {{ connection: 'never-connected' | 'connected' | 'disconnected' }} props
 */
export default function KittBar({ connection }) {
  const isLive = connection === 'connected';
  return (
    <div className={`kitt-bar${isLive ? ' kitt-bar--live' : ''}`} aria-hidden="true">
      <div className="kitt-bar__track" />
      {isLive && <div className="kitt-bar__scanner" />}
    </div>
  );
}
