import { useState, useEffect } from 'react';
import { WhiteboardSync } from './whiteboard-sync';

export function useWhiteboardSync(roomId: string, token: string) {
  const [sync, setSync] = useState<WhiteboardSync | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (roomId && token) {
      const whiteboardSync = new WhiteboardSync(roomId, token);

      const checkConnection = setInterval(() => {
        setIsConnected(whiteboardSync.isConnected());
      }, 1000);

      setSync(whiteboardSync);
      setIsConnected(whiteboardSync.isConnected());

      return () => {
        clearInterval(checkConnection);
        whiteboardSync.disconnect();
      };
    }
  }, [roomId, token]);

  return { sync, isConnected };
}