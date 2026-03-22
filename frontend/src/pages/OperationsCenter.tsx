import AIDecisionFeed from "../components/operations-center/AIDecisionFeed";
import CostImpactTicker from "../components/operations-center/CostImpactTicker";
import AlertPanel from "../components/operations-center/AlertPanel";
import AgentCollaborationPanel from "../components/operations-center/AgentCollaborationPanel";
import GovernanceScorecardWidget from "../components/operations-center/GovernanceScorecardWidget";
import MetricsSidebar from "../components/metrics/MetricsSidebar";

export default function OperationsCenter() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-4 overflow-hidden">
      {/* Main content — AI Decision Feed + Agent Collaboration */}
      <div className="col-span-8 flex min-h-0 flex-col gap-4 overflow-hidden">
        <CostImpactTicker />

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
          <AIDecisionFeed />
          <AgentCollaborationPanel />
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
