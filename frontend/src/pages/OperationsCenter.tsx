import AIDecisionFeed from "../components/operations-center/AIDecisionFeed";
import CostImpactTicker from "../components/operations-center/CostImpactTicker";
import AlertPanel from "../components/operations-center/AlertPanel";
import AnomalyTimeline from "../components/operations-center/AnomalyTimeline";
import AgentCollaborationPanel from "../components/operations-center/AgentCollaborationPanel";
import GovernanceScorecardWidget from "../components/operations-center/GovernanceScorecardWidget";
import MetricsSidebar from "../components/metrics/MetricsSidebar";
import ChatPanel from "../components/chat/ChatPanel";

export default function OperationsCenter() {
  return (
    <div className="grid h-full grid-cols-12 gap-4">
      {/* Main content — AI Decision Feed + Agent Collaboration */}
      <div className="col-span-8 flex flex-col gap-4 overflow-hidden">
        <CostImpactTicker />

        <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden">
          <AIDecisionFeed />
          <AgentCollaborationPanel />
        </div>

        <AnomalyTimeline />
      </div>

      {/* Right sidebar — Metrics + Governance + Alerts + Chat */}
      <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
        <MetricsSidebar />
        <GovernanceScorecardWidget />
        <AlertPanel />
        <ChatPanel />
      </div>
    </div>
  );
}
