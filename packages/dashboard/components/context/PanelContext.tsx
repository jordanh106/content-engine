import React, { createContext, useContext, useState, useCallback } from "react";

type PanelContextValue = {
  panelCount: number;
  registerPanel: () => () => void;
};

const PanelContext = createContext<PanelContextValue>({
  panelCount: 0,
  registerPanel: () => () => {},
});

export const PanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [panelCount, setPanelCount] = useState(0);

  const registerPanel = useCallback(() => {
    setPanelCount((c) => c + 1);
    return () => setPanelCount((c) => Math.max(0, c - 1));
  }, []);

  return (
    <PanelContext.Provider value={{ panelCount, registerPanel }}>
      {children}
    </PanelContext.Provider>
  );
};

export const usePanel = () => useContext(PanelContext);

/** Call this hook inside any slide-out panel to auto-register it */
export const useRegisterPanel = (isOpen: boolean) => {
  const { registerPanel } = usePanel();
  React.useEffect(() => {
    if (!isOpen) return;
    const unregister = registerPanel();
    return unregister;
  }, [isOpen, registerPanel]);
};
