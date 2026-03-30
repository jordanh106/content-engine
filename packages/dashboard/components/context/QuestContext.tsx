import React, { createContext, useContext } from "react";
import { useQuestTracker, type CoachToast } from "../../hooks/useQuestTracker.js";

type QuestContextValue = {
  trackAction: (action: string, target?: string) => Promise<void>;
  coachToast: CoachToast | null;
  dismissToast: () => void;
};

const QuestContext = createContext<QuestContextValue>({
  trackAction: async () => {},
  coachToast: null,
  dismissToast: () => {},
});

export const QuestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tracker = useQuestTracker();
  return (
    <QuestContext.Provider value={tracker}>
      {children}
    </QuestContext.Provider>
  );
};

export const useQuest = () => useContext(QuestContext);
