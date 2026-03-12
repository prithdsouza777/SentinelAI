"""Multi-Agent Negotiation Protocol.

Resolves conflicts between agents using a weighted priority system
based on severity, confidence, and time horizon.
"""

import uuid

from app.models import AgentNegotiation, AgentType, NegotiationProposal


class NegotiationProtocol:
    def resolve(self, proposals: list[NegotiationProposal]) -> AgentNegotiation:
        """Resolve conflicting agent proposals using weighted priority."""
        # Weighted score: priority(0.4) + confidence(0.3) + normalised_priority(0.3)
        def score(p: NegotiationProposal) -> float:
            return p.priority * 0.4 + p.confidence * 0.3 + (p.priority / 10.0) * 0.3

        scored = sorted(proposals, key=score, reverse=True)
        winner = scored[0] if scored else None
        losers = scored[1:] if len(scored) > 1 else []

        if winner is None:
            resolution = "No resolution — no proposals submitted."
        else:
            winner_score = score(winner)
            loser_names = ", ".join(p.agent_type.value for p in losers) if losers else "none"
            resolution = (
                f"{winner.agent_type.value} wins (score: {winner_score:.2f}): "
                f"'{winner.proposal}'. "
                f"Outscored: {loser_names}. "
                f"Conflict on shared resource resolved — "
                f"{winner.agent_type.value} action proceeds to approval gate."
            )

        return AgentNegotiation(
            id=str(uuid.uuid4())[:8],
            agents=[p.agent_type for p in proposals],
            topic="Resource allocation conflict",
            proposals=proposals,
            resolution=resolution,
        )


negotiation_protocol = NegotiationProtocol()
