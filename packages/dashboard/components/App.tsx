import React, { useState } from "react";
import type { DashboardView } from "../shared/types.js";
import { Layout } from "./Layout.js";
import { ContentLibrary } from "./ContentLibrary.js";
import { VideoDetail } from "./VideoDetail.js";

export const App: React.FC = () => {
  const [view, setView] = useState<DashboardView>("LIBRARY");
  const [selectedVideoCode, setSelectedVideoCode] = useState<string | null>(null);

  const handleSelectVideo = (code: string) => {
    setSelectedVideoCode(code);
  };

  const handleCloseDetail = () => {
    setSelectedVideoCode(null);
  };

  return (
    <Layout currentView={view} onNavigate={setView}>
      {view === "LIBRARY" && (
        <ContentLibrary onSelectVideo={handleSelectVideo} />
      )}
      {view === "HOME" && (
        <div className="p-6 text-slate-500 text-center">
          <p className="text-lg font-serif">Dashboard Home</p>
          <p className="text-sm mt-2">Coming in Phase 2</p>
        </div>
      )}
      {view === "PIPELINE" && (
        <div className="p-6 text-slate-500 text-center">
          <p className="text-lg font-serif">Pipeline Board</p>
          <p className="text-sm mt-2">Coming in Phase 2</p>
        </div>
      )}
      {view === "CALENDAR" && (
        <div className="p-6 text-slate-500 text-center">
          <p className="text-lg font-serif">Calendar</p>
          <p className="text-sm mt-2">Coming in Phase 4</p>
        </div>
      )}
      {view === "SESSION" && (
        <div className="p-6 text-slate-500 text-center">
          <p className="text-lg font-serif">Session Planner</p>
          <p className="text-sm mt-2">Coming in Phase 3</p>
        </div>
      )}

      {selectedVideoCode && (
        <VideoDetail code={selectedVideoCode} onClose={handleCloseDetail} />
      )}
    </Layout>
  );
};
