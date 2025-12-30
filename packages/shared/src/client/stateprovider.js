"use client";

import React from 'react';
import { stateManager } from './statemanager.js';
import { useTopLevelStateController } from './toplevelstatecontroller.js';

export function StateProvider(props) {
  const { isSandbox, children } = props;
  const state = useTopLevelStateController({ isSandbox });

  return (
    <stateManager.Provider value={state}>
      {children}
    </stateManager.Provider>
  );
}
