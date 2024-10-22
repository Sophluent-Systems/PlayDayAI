import React, { useState, useCallback } from 'react';
import { AlertContext } from './AlertContext';
import { AlertComponent } from './AlertComponent';

export function AlertProvider({ children }) {
  const [alertOptions, setAlertOptions] = useState(null);

  const showAlert = useCallback((title, message, actions) => {
    setAlertOptions({ title, message, actions });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertOptions(null);
  }, []);

  return (
    <AlertContext.Provider value={{ alert: showAlert }}>
      {children}
      {alertOptions && <AlertComponent {...alertOptions} onClose={closeAlert} />}
    </AlertContext.Provider>
  );
};
