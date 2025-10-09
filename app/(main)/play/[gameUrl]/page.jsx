'use client';

import React, { memo, useContext, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import ChatBot from '@src/client/components/chatbot';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { stateManager } from '@src/client/statemanager';
import { useViewportDimensions } from '@src/client/hooks/useViewportDimensions';
import { defaultAppTheme } from '@src/common/theme';

function Home() {
  const {
    account,
    loading,
    game,
    versionList,
    version,
    session,
    switchVersionByName,
    gamePermissions,
  } = useContext(stateManager);

  const chatContainerRef = useRef(null);
  const { width: viewportWidth, height: viewportHeight } = useViewportDimensions();

  const themeToUse = game?.theme || defaultAppTheme;

  useEffect(() => {
    if (game && account && versionList && versionList.length > 0 && !version) {
      if (game.primaryVersion && versionList.find((item) => item.versionName === game.primaryVersion)) {
        switchVersionByName(game.primaryVersion);
        return;
      }
      const sorted = [...versionList].sort(
        (a, b) => new Date(b.lastUpdatedDate).getTime() - new Date(a.lastUpdatedDate).getTime()
      );
      switchVersionByName(sorted[0].versionName);
    }
  }, [account, versionList, game, version, switchVersionByName]);

  const chatBotDimensions = useMemo(() => {
    return {
      width: viewportWidth,
      height: viewportHeight,
    };
  }, [viewportWidth, viewportHeight]);

  const chatBotContainerStyle = useMemo(() => {
    return {
      width: `${chatBotDimensions.width}px`,
      height: `${chatBotDimensions.height}px`,
    };
  }, [chatBotDimensions]);

  const canPlay = useMemo(() => gamePermissions?.includes('game_play'), [gamePermissions]);

  const renderContent = () => {
    if (loading || !account || !gamePermissions) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center text-muted">Loading workspace...</div>
        </div>
      );
    }

    if (!canPlay) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center text-muted">You are not authorised to play this game.</div>
        </div>
      );
    }

    return (
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div
          ref={chatContainerRef}
          style={chatBotContainerStyle}
          className="flex"
        >
          <ChatBot
            url={game?.url}
            title={game?.title}
            theme={themeToUse}
            session={session}
            version={version}
            versionList={versionList}
          />
        </div>
      </div>
    );
  };

  return (
    <RequireAuthentication>
      <div
        className={clsx(
          'relative flex h-screen flex-col overflow-hidden bg-background'
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-gradient-to-b from-primary/15 via-background to-transparent"
          aria-hidden="true"
        />
        <div className="relative z-10 flex w-full flex-1 flex-col min-h-0">
          {renderContent()}
        </div>
      </div>
    </RequireAuthentication>
  );
}

export default memo(Home);
