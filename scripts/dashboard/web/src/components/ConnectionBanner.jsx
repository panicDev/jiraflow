import React from 'react';

/**
 * SSE connection status banner.
 * When connected, nothing is displayed.
 *
 * @param {{ connection: 'never-connected' | 'connected' | 'disconnected' }} props
 */
export default function ConnectionBanner({ connection }) {
  if (connection === 'connected') return null;

  const message =
    connection === 'never-connected'
      ? 'Unable to connect to backend (127.0.0.1:4173). Please start the server first with `node scripts/dashboard/server.js`.'
      : 'The backend connection was lost. It will automatically attempt to reconnect… ';

  return (
    <div className="conn-banner" role="alert">
      {message}
    </div>
  );
}
