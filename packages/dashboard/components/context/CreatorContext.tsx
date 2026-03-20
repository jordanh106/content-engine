import React, { createContext, useContext, useState } from "react";

type CreatorContextValue = {
  selectedCreatorId: number | null;
  setSelectedCreatorId: (id: number | null) => void;
};

const CreatorContext = createContext<CreatorContextValue>({
  selectedCreatorId: null,
  setSelectedCreatorId: () => {},
});

export const CreatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCreatorId, setSelectedCreatorIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem("creator_persona_id");
    return stored ? parseInt(stored, 10) : null;
  });

  const setSelectedCreatorId = (id: number | null) => {
    setSelectedCreatorIdState(id);
    if (id === null) {
      localStorage.removeItem("creator_persona_id");
    } else {
      localStorage.setItem("creator_persona_id", String(id));
    }
  };

  return (
    <CreatorContext.Provider value={{ selectedCreatorId, setSelectedCreatorId }}>
      {children}
    </CreatorContext.Provider>
  );
};

export const useCreator = () => useContext(CreatorContext);
