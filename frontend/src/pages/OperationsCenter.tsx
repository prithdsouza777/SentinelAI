import AIDecisionFeed from "../components/operations-center/AIDecisionFeed";
import CostImpactTicker from "../components/operations-center/CostImpactTicker";
import AlertPanel from "../components/operations-center/AlertPanel";
import AgentCollaborationPanel from "../components/operations-center/AgentCollaborationPanel";
import GovernanceScorecardWidget from "../components/operations-center/GovernanceScorecardWidget";
import AgentMovementToasts from "../components/operations-center/AgentMovementToasts";
import MetricsSidebar from "../components/metrics/MetricsSidebar";
import { TrendChart } from "../components/operations-center/TrendChart";
import AnomalyTimeline from "../components/operations-center/AnomalyTimeline";
import { useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useDashboardStore } from "../stores/dashboardStore";

export default function OperationsCenter() {
  const [latestWsData, setLatestWsData] = useState<any>(null);
  const isDemoRunning = useDashboardStore((s) => s.simulationActive);

  useWebSocket("*", (msg) => {
    setLatestWsData(msg);
  });

  return (
    <div className="grid grid-cols-12 gap-4">
      <AgentMovementToasts />
      {/* Main content — Trend Chart + AI Decision Feed + Agent Collaboration */}
      <div 
        className="col-span-8 flex flex-col gap-4 p-4 pb-16"
      >
        <div className="flex-shrink-0">
          <CostImpactTicker />
        </div>

        {/* 2. Trend Chart — FIXED HEIGHT, never grows */}
        <div className="flex-shrink-0">
          <TrendChart wsData={latestWsData} isRunning={isDemoRunning} />
        </div>

        <div className="grid grid-cols-2 gap-4 h-[500px]">
          <AIDecisionFeed />
          <AgentCollaborationPanel />
        </div>

        {/* 4. Anomaly Timeline */}
        <div className="flex-shrink-0">
          <AnomalyTimeline />
        </div>
      </div>

      {/* Right sidebar — Metrics + Governance + Alerts */}
      <div className="col-span-4 flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
        <MetricsSidebar />
        <GovernanceScorecardWidget />
        <AlertPanel />
      </div>
    </div>
  );
}
