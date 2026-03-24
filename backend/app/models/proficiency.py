"""Human agent proficiency models for the agent workforce database.

Tracks per-skill proficiency ratings and pre-computed department fitness
scores so routing decisions are instant tag lookups instead of recalculations.
"""

from app.models.agent import CamelModel


class SkillProficiency(CamelModel):
    """A single skill rating for a human agent."""

    skill_name: str      # e.g. "troubleshooting"
    proficiency: float   # 0.0-1.0 (0=none, 0.3=basic, 0.6=competent, 0.85=expert, 1.0=master)


class DepartmentFitness(CamelModel):
    """Pre-computed fitness score for one department — the 'tag'."""

    department_id: str      # e.g. "q-support"
    department_name: str    # e.g. "Support"
    fitness_score: float    # 0.0-1.0


class HumanAgentProfile(CamelModel):
    """Full profile of a contact-center human agent."""

    id: str
    name: str
    current_queue_id: str                          # where they are right now
    home_queue_id: str                             # their primary department
    role: str                                      # "senior" | "mid" | "junior"
    perf_score: float                              # 0.0-1.0 historical performance
    skill_proficiencies: list[SkillProficiency]    # ratings for ALL 12 skills
    department_scores: list[DepartmentFitness]     # pre-computed fitness per dept
    status: str = "available"                      # available | busy | on_break

    def proficiency_for(self, skill_name: str) -> float:
        """Look up proficiency for a given skill. Returns 0.0 if not found."""
        for sp in self.skill_proficiencies:
            if sp.skill_name == skill_name:
                return sp.proficiency
        return 0.0

    def department_score_for(self, department_id: str) -> float:
        """Look up pre-computed fitness for a department. Returns 0.0 if not found."""
        for ds in self.department_scores:
            if ds.department_id == department_id:
                return ds.fitness_score
        return 0.0
