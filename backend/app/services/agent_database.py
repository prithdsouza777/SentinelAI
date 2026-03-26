"""Agent Workforce Database — SQLite-backed store for human agent profiles.

Each agent has per-skill proficiency ratings (0.0-1.0) and pre-computed
department fitness scores ('tags') so routing decisions are instant lookups.

Data persists across server restarts via SQLite. On first run, seed data is
loaded automatically. Subsequent runs read from the DB file.

Singleton: import `agent_database` and call `.initialize()` once at startup.
"""

import logging
import sqlite3
from pathlib import Path
from typing import Optional

from app.models.proficiency import DepartmentFitness, HumanAgentProfile, SkillProficiency

logger = logging.getLogger("sentinelai.agent_database")

# Database file location — next to the backend app
DB_PATH = Path(__file__).resolve().parent.parent.parent / "agents.db"

# ── All skills in the system ────────────────────────────────────────────────
ALL_SKILLS = [
    "troubleshooting", "product_knowledge", "technical",
    "billing", "payments", "account_management",
    "sales", "upselling",
    "general_inquiry",
    "vip_handling", "escalation", "retention",
]

# ── Department skill weights (what each dept values) ────────────────────────
DEPARTMENT_SKILL_WEIGHTS: dict[str, dict[str, float]] = {
    "q-support": {"troubleshooting": 0.40, "product_knowledge": 0.30, "technical": 0.30},
    "q-billing": {"billing": 0.40, "payments": 0.35, "account_management": 0.25},
    "q-sales":   {"sales": 0.40, "product_knowledge": 0.30, "upselling": 0.30},
    "q-general": {"general_inquiry": 0.50, "product_knowledge": 0.50},
    "q-vip":     {"vip_handling": 0.35, "escalation": 0.35, "retention": 0.30},
}

DEPARTMENT_NAMES: dict[str, str] = {
    "q-support": "Support",
    "q-billing": "Billing",
    "q-sales": "Sales",
    "q-general": "General",
    "q-vip": "VIP",
}

EXPERIENCE_FACTOR: dict[str, float] = {
    "senior": 1.0,
    "mid": 0.75,
    "junior": 0.50,
}

# ── Guardrail: minimum fitness to allow a move ──────────────────────────────
# Agents with fitness below this threshold for the target department are
# blocked from being moved there. Prevents e.g. a billing-only agent being
# thrown into tech support where they'd be useless.
MIN_FITNESS_THRESHOLD = 0.40

# ── Seed data ───────────────────────────────────────────────────────────────
# Format: (id, name, home_queue, role, perf_score, {skill: proficiency})

_SEED_AGENTS: list[tuple[str, str, str, str, float, dict[str, float]]] = [
    # ── Support (5 agents) ──
    ("agent-01", "Alice", "q-support", "senior", 0.95, {
        "troubleshooting": 0.95, "technical": 0.90, "product_knowledge": 0.70,
        "escalation": 0.75, "general_inquiry": 0.40, "billing": 0.15,
        "payments": 0.10, "account_management": 0.10, "sales": 0.05,
        "upselling": 0.05, "vip_handling": 0.30, "retention": 0.20,
    }),
    ("agent-02", "Bob", "q-support", "mid", 0.82, {
        "troubleshooting": 0.75, "technical": 0.55, "product_knowledge": 0.70,
        "escalation": 0.30, "general_inquiry": 0.50, "billing": 0.20,
        "payments": 0.15, "account_management": 0.10, "sales": 0.15,
        "upselling": 0.10, "vip_handling": 0.05, "retention": 0.10,
    }),
    ("agent-03", "Carol", "q-support", "junior", 0.74, {
        "troubleshooting": 0.60, "technical": 0.45, "product_knowledge": 0.50,
        "escalation": 0.15, "general_inquiry": 0.55, "billing": 0.10,
        "payments": 0.05, "account_management": 0.05, "sales": 0.10,
        "upselling": 0.05, "vip_handling": 0.05, "retention": 0.05,
    }),
    ("agent-12", "Leo", "q-support", "senior", 0.88, {
        "troubleshooting": 0.85, "technical": 0.90, "product_knowledge": 0.80,
        "escalation": 0.45, "general_inquiry": 0.35, "billing": 0.20,
        "payments": 0.15, "account_management": 0.10, "sales": 0.20,
        "upselling": 0.10, "vip_handling": 0.15, "retention": 0.15,
    }),
    ("agent-13", "Mia", "q-support", "mid", 0.80, {
        "troubleshooting": 0.70, "technical": 0.65, "product_knowledge": 0.60,
        "escalation": 0.25, "general_inquiry": 0.45, "billing": 0.25,
        "payments": 0.20, "account_management": 0.15, "sales": 0.10,
        "upselling": 0.05, "vip_handling": 0.10, "retention": 0.10,
    }),

    # ── Billing (4 agents) ──
    ("agent-04", "Dave", "q-billing", "senior", 0.91, {
        "billing": 0.95, "payments": 0.90, "account_management": 0.85,
        "troubleshooting": 0.30, "technical": 0.15, "product_knowledge": 0.45,
        "sales": 0.20, "upselling": 0.15, "general_inquiry": 0.35,
        "vip_handling": 0.25, "escalation": 0.40, "retention": 0.30,
    }),
    ("agent-05", "Eve", "q-billing", "mid", 0.85, {
        "billing": 0.80, "payments": 0.75, "account_management": 0.60,
        "troubleshooting": 0.20, "technical": 0.10, "product_knowledge": 0.40,
        "sales": 0.15, "upselling": 0.10, "general_inquiry": 0.30,
        "vip_handling": 0.10, "escalation": 0.20, "retention": 0.15,
    }),
    ("agent-14", "Nina", "q-billing", "junior", 0.73, {
        "billing": 0.60, "payments": 0.55, "account_management": 0.45,
        "troubleshooting": 0.15, "technical": 0.05, "product_knowledge": 0.30,
        "sales": 0.10, "upselling": 0.05, "general_inquiry": 0.25,
        "vip_handling": 0.05, "escalation": 0.10, "retention": 0.10,
    }),
    ("agent-15", "Oscar", "q-billing", "mid", 0.84, {
        "billing": 0.78, "payments": 0.80, "account_management": 0.65,
        "troubleshooting": 0.25, "technical": 0.10, "product_knowledge": 0.35,
        "sales": 0.25, "upselling": 0.20, "general_inquiry": 0.30,
        "vip_handling": 0.10, "escalation": 0.15, "retention": 0.20,
    }),

    # ── Sales (4 agents) ──
    ("agent-06", "Frank", "q-sales", "senior", 0.93, {
        "sales": 0.95, "upselling": 0.90, "product_knowledge": 0.85,
        "retention": 0.60, "billing": 0.25, "payments": 0.15,
        "account_management": 0.10, "troubleshooting": 0.15, "technical": 0.10,
        "general_inquiry": 0.35, "vip_handling": 0.30, "escalation": 0.20,
    }),
    ("agent-07", "Grace", "q-sales", "mid", 0.79, {
        "sales": 0.75, "upselling": 0.60, "product_knowledge": 0.70,
        "retention": 0.40, "billing": 0.15, "payments": 0.10,
        "account_management": 0.05, "troubleshooting": 0.20, "technical": 0.10,
        "general_inquiry": 0.40, "vip_handling": 0.10, "escalation": 0.10,
    }),
    ("agent-16", "Paul", "q-sales", "junior", 0.71, {
        "sales": 0.60, "upselling": 0.50, "product_knowledge": 0.55,
        "retention": 0.25, "billing": 0.10, "payments": 0.05,
        "account_management": 0.05, "troubleshooting": 0.10, "technical": 0.05,
        "general_inquiry": 0.30, "vip_handling": 0.05, "escalation": 0.05,
    }),
    ("agent-17", "Quinn", "q-sales", "mid", 0.83, {
        "sales": 0.80, "upselling": 0.70, "product_knowledge": 0.75,
        "retention": 0.50, "billing": 0.20, "payments": 0.10,
        "account_management": 0.10, "troubleshooting": 0.15, "technical": 0.05,
        "general_inquiry": 0.35, "vip_handling": 0.15, "escalation": 0.15,
    }),

    # ── General (4 agents) ──
    ("agent-08", "Hank", "q-general", "mid", 0.80, {
        "general_inquiry": 0.80, "product_knowledge": 0.75, "troubleshooting": 0.65,
        "billing": 0.30, "payments": 0.20, "account_management": 0.15,
        "sales": 0.25, "upselling": 0.10, "technical": 0.40,
        "vip_handling": 0.10, "escalation": 0.15, "retention": 0.15,
    }),
    ("agent-09", "Iris", "q-general", "junior", 0.72, {
        "general_inquiry": 0.65, "product_knowledge": 0.55, "troubleshooting": 0.25,
        "billing": 0.40, "payments": 0.30, "account_management": 0.20,
        "sales": 0.15, "upselling": 0.05, "technical": 0.10,
        "vip_handling": 0.05, "escalation": 0.10, "retention": 0.10,
    }),
    ("agent-18", "Rita", "q-general", "senior", 0.87, {
        "general_inquiry": 0.90, "product_knowledge": 0.85, "troubleshooting": 0.50,
        "billing": 0.35, "payments": 0.25, "account_management": 0.20,
        "sales": 0.30, "upselling": 0.15, "technical": 0.30,
        "vip_handling": 0.20, "escalation": 0.30, "retention": 0.25,
    }),
    ("agent-19", "Sam", "q-general", "mid", 0.78, {
        "general_inquiry": 0.75, "product_knowledge": 0.70, "troubleshooting": 0.45,
        "billing": 0.25, "payments": 0.15, "account_management": 0.10,
        "sales": 0.20, "upselling": 0.10, "technical": 0.25,
        "vip_handling": 0.10, "escalation": 0.15, "retention": 0.15,
    }),

    # ── VIP (3 agents) ──
    ("agent-10", "Jack", "q-vip", "senior", 0.97, {
        "vip_handling": 0.95, "escalation": 0.90, "retention": 0.85,
        "sales": 0.60, "troubleshooting": 0.45, "product_knowledge": 0.65,
        "billing": 0.35, "payments": 0.25, "account_management": 0.20,
        "technical": 0.20, "upselling": 0.40, "general_inquiry": 0.40,
    }),
    ("agent-11", "Kim", "q-vip", "senior", 0.90, {
        "vip_handling": 0.85, "escalation": 0.75, "retention": 0.80,
        "sales": 0.40, "troubleshooting": 0.30, "product_knowledge": 0.55,
        "billing": 0.30, "payments": 0.20, "account_management": 0.15,
        "technical": 0.15, "upselling": 0.30, "general_inquiry": 0.35,
    }),
    ("agent-20", "Tom", "q-vip", "mid", 0.81, {
        "vip_handling": 0.70, "escalation": 0.65, "retention": 0.60,
        "sales": 0.35, "troubleshooting": 0.25, "product_knowledge": 0.45,
        "billing": 0.20, "payments": 0.15, "account_management": 0.10,
        "technical": 0.10, "upselling": 0.25, "general_inquiry": 0.30,
    }),

    # ── Floaters (4 agents — broad cross-skills, natural rebalancing candidates) ──
    ("agent-21", "Uma", "q-support", "mid", 0.83, {
        "troubleshooting": 0.65, "technical": 0.55, "product_knowledge": 0.65,
        "billing": 0.50, "payments": 0.40, "account_management": 0.35,
        "sales": 0.45, "upselling": 0.30, "general_inquiry": 0.60,
        "vip_handling": 0.25, "escalation": 0.35, "retention": 0.30,
    }),
    ("agent-22", "Vera", "q-billing", "senior", 0.89, {
        "billing": 0.70, "payments": 0.65, "account_management": 0.60,
        "troubleshooting": 0.50, "technical": 0.35, "product_knowledge": 0.60,
        "sales": 0.55, "upselling": 0.40, "general_inquiry": 0.50,
        "vip_handling": 0.30, "escalation": 0.45, "retention": 0.40,
    }),
    ("agent-23", "Will", "q-general", "senior", 0.86, {
        "general_inquiry": 0.70, "product_knowledge": 0.75, "troubleshooting": 0.60,
        "billing": 0.45, "payments": 0.35, "account_management": 0.30,
        "sales": 0.50, "upselling": 0.35, "technical": 0.45,
        "vip_handling": 0.35, "escalation": 0.40, "retention": 0.35,
    }),
    ("agent-24", "Zara", "q-sales", "mid", 0.82, {
        "sales": 0.65, "upselling": 0.50, "product_knowledge": 0.60,
        "troubleshooting": 0.45, "technical": 0.30, "billing": 0.40,
        "payments": 0.30, "account_management": 0.25, "general_inquiry": 0.55,
        "vip_handling": 0.20, "escalation": 0.30, "retention": 0.45,
    }),
]


# ── SQLite schema ────────────────────────────────────────────────────────────

_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS agents (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    current_queue_id TEXT NOT NULL,
    home_queue_id   TEXT NOT NULL,
    role            TEXT NOT NULL,
    perf_score      REAL NOT NULL,
    status          TEXT NOT NULL DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS skill_proficiencies (
    agent_id    TEXT NOT NULL,
    skill_name  TEXT NOT NULL,
    proficiency REAL NOT NULL,
    PRIMARY KEY (agent_id, skill_name),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS department_scores (
    agent_id        TEXT NOT NULL,
    department_id   TEXT NOT NULL,
    department_name TEXT NOT NULL,
    fitness_score   REAL NOT NULL,
    PRIMARY KEY (agent_id, department_id),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);
"""


class AgentDatabase:
    """SQLite-backed workforce database with pre-computed department fitness tags."""

    def __init__(self) -> None:
        self._initialized = False
        self._db_path = str(DB_PATH)
        self._conn: sqlite3.Connection | None = None

    def _connect(self) -> sqlite3.Connection:
        """Return a cached SQLite connection (WAL mode, single-writer safe)."""
        if self._conn is not None:
            return self._conn
        conn = sqlite3.connect(self._db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        self._conn = conn
        return conn

    def initialize(self) -> None:
        """Create tables and seed data if DB is empty. Call once at startup."""
        if self._initialized:
            return

        conn = self._connect()
        try:
            conn.executescript(_CREATE_TABLES)

            # Check if data already exists
            count = conn.execute("SELECT COUNT(*) FROM agents").fetchone()[0]
            if count == 0:
                logger.info("Seeding agent database with %d agents...", len(_SEED_AGENTS))
                self._seed_database(conn)
            else:
                logger.info("Agent database loaded from SQLite — %d agents", count)

            conn.commit()
        finally:
            pass  # Connection cached for reuse

        self._initialized = True

    def _seed_database(self, conn: sqlite3.Connection) -> None:
        """Insert seed data and compute department scores."""
        for aid, name, home_q, role, perf, skills in _SEED_AGENTS:
            conn.execute(
                "INSERT INTO agents (id, name, current_queue_id, home_queue_id, role, perf_score, status) "
                "VALUES (?, ?, ?, ?, ?, ?, 'available')",
                (aid, name, home_q, home_q, role, perf),
            )
            for skill_name in ALL_SKILLS:
                prof = skills.get(skill_name, 0.0)
                conn.execute(
                    "INSERT INTO skill_proficiencies (agent_id, skill_name, proficiency) VALUES (?, ?, ?)",
                    (aid, skill_name, prof),
                )

            # Compute department fitness scores
            exp_factor = EXPERIENCE_FACTOR.get(role, 0.5)
            for dept_id, skill_weights in DEPARTMENT_SKILL_WEIGHTS.items():
                weighted_match = sum(
                    skills.get(skill, 0.0) * weight
                    for skill, weight in skill_weights.items()
                )
                fitness = round(
                    min(1.0, max(0.0, weighted_match * 0.50 + exp_factor * 0.25 + perf * 0.25)),
                    3,
                )
                conn.execute(
                    "INSERT INTO department_scores (agent_id, department_id, department_name, fitness_score) "
                    "VALUES (?, ?, ?, ?)",
                    (aid, dept_id, DEPARTMENT_NAMES[dept_id], fitness),
                )

    # ── Row → Model conversion ───────────────────────────────────────────────

    def _row_to_profile(self, conn: sqlite3.Connection, row: sqlite3.Row) -> HumanAgentProfile:
        """Convert an agent row + related rows into a HumanAgentProfile (2 extra queries)."""
        agent_id = row["id"]

        skills = [
            SkillProficiency(skill_name=r["skill_name"], proficiency=r["proficiency"])
            for r in conn.execute(
                "SELECT skill_name, proficiency FROM skill_proficiencies WHERE agent_id = ? ORDER BY proficiency DESC",
                (agent_id,),
            )
        ]

        dept_scores = [
            DepartmentFitness(
                department_id=r["department_id"],
                department_name=r["department_name"],
                fitness_score=r["fitness_score"],
            )
            for r in conn.execute(
                "SELECT department_id, department_name, fitness_score FROM department_scores "
                "WHERE agent_id = ? ORDER BY fitness_score DESC",
                (agent_id,),
            )
        ]

        return HumanAgentProfile(
            id=row["id"],
            name=row["name"],
            current_queue_id=row["current_queue_id"],
            home_queue_id=row["home_queue_id"],
            role=row["role"],
            perf_score=row["perf_score"],
            skill_proficiencies=skills,
            department_scores=dept_scores,
            status=row["status"],
        )

    def _batch_load_profiles(self, conn: sqlite3.Connection, agent_rows: list[sqlite3.Row]) -> list[HumanAgentProfile]:
        """Batch-load profiles for multiple agents using 2 queries instead of 2*N.

        Avoids the N+1 query problem: fetches all skills and dept scores in bulk,
        then assembles profiles in-memory.
        """
        if not agent_rows:
            return []

        agent_ids = [r["id"] for r in agent_rows]
        placeholders = ",".join("?" for _ in agent_ids)

        # Batch fetch all skills for these agents (1 query)
        skills_map: dict[str, list[SkillProficiency]] = {aid: [] for aid in agent_ids}
        for r in conn.execute(
            f"SELECT agent_id, skill_name, proficiency FROM skill_proficiencies "
            f"WHERE agent_id IN ({placeholders}) ORDER BY proficiency DESC",
            agent_ids,
        ):
            skills_map[r["agent_id"]].append(
                SkillProficiency(skill_name=r["skill_name"], proficiency=r["proficiency"])
            )

        # Batch fetch all dept scores for these agents (1 query)
        dept_map: dict[str, list[DepartmentFitness]] = {aid: [] for aid in agent_ids}
        for r in conn.execute(
            f"SELECT agent_id, department_id, department_name, fitness_score FROM department_scores "
            f"WHERE agent_id IN ({placeholders}) ORDER BY fitness_score DESC",
            agent_ids,
        ):
            dept_map[r["agent_id"]].append(
                DepartmentFitness(
                    department_id=r["department_id"],
                    department_name=r["department_name"],
                    fitness_score=r["fitness_score"],
                )
            )

        return [
            HumanAgentProfile(
                id=row["id"],
                name=row["name"],
                current_queue_id=row["current_queue_id"],
                home_queue_id=row["home_queue_id"],
                role=row["role"],
                perf_score=row["perf_score"],
                skill_proficiencies=skills_map.get(row["id"], []),
                department_scores=dept_map.get(row["id"], []),
                status=row["status"],
            )
            for row in agent_rows
        ]

    # ── Score computation ────────────────────────────────────────────────────

    def recompute_scores(self, agent_id: str) -> None:
        """Recompute department scores for a single agent (e.g. after perf change)."""
        conn = self._connect()
        try:
            row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
            if not row:
                return

            skills = {
                r["skill_name"]: r["proficiency"]
                for r in conn.execute(
                    "SELECT skill_name, proficiency FROM skill_proficiencies WHERE agent_id = ?",
                    (agent_id,),
                )
            }
            exp_factor = EXPERIENCE_FACTOR.get(row["role"], 0.5)

            for dept_id, skill_weights in DEPARTMENT_SKILL_WEIGHTS.items():
                weighted_match = sum(
                    skills.get(skill, 0.0) * weight
                    for skill, weight in skill_weights.items()
                )
                fitness = round(
                    min(1.0, max(0.0, weighted_match * 0.50 + exp_factor * 0.25 + row["perf_score"] * 0.25)),
                    3,
                )
                conn.execute(
                    "UPDATE department_scores SET fitness_score = ? WHERE agent_id = ? AND department_id = ?",
                    (fitness, agent_id, dept_id),
                )
            conn.commit()
        finally:
            pass  # Connection cached for reuse

    # ── Lookups ──────────────────────────────────────────────────────────────

    def get_agent(self, agent_id: str) -> Optional[HumanAgentProfile]:
        conn = self._connect()
        try:
            row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
            if not row:
                return None
            return self._row_to_profile(conn, row)
        finally:
            pass  # Connection cached for reuse

    def get_agent_by_name(self, name: str) -> Optional[HumanAgentProfile]:
        """Find a single agent by name (case-insensitive). Much faster than get_all_agents() for lookups."""
        conn = self._connect()
        try:
            row = conn.execute(
                "SELECT * FROM agents WHERE LOWER(name) = LOWER(?)", (name,)
            ).fetchone()
            if not row:
                return None
            return self._row_to_profile(conn, row)
        finally:
            pass  # Connection cached for reuse

    def get_all_agents(self) -> list[HumanAgentProfile]:
        conn = self._connect()
        try:
            rows = conn.execute("SELECT * FROM agents ORDER BY name").fetchall()
            return self._batch_load_profiles(conn, rows)
        finally:
            pass  # Connection cached for reuse

    def get_agents_in_queue(self, queue_id: str) -> list[HumanAgentProfile]:
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT * FROM agents WHERE current_queue_id = ?", (queue_id,)
            ).fetchall()
            return self._batch_load_profiles(conn, rows)
        finally:
            pass  # Connection cached for reuse

    # ── Smart selection ──────────────────────────────────────────────────────

    def get_best_agents_for_department(
        self,
        target_dept_id: str,
        count: int = 2,
        exclude_queues: Optional[list[str]] = None,
        min_remaining: int = 2,
        force: bool = False,
    ) -> list[HumanAgentProfile]:
        """Return the best-fit agents for a target department.

        Searches agents NOT already in the target dept, ranked by a transfer
        score that balances target fitness against source fitness — so agents
        who are *less critical* to their current queue are preferred over
        top performers even if both have decent target fitness.

        Transfer score = target_fitness * 0.6 - source_fitness * 0.4

        If force=True (used by human policy enforcement), bypasses the
        fitness threshold — but still prefers available agents over busy ones.
        Busy agents are included but ranked lower so available agents move first.
        """
        exclude = set(exclude_queues or [])
        exclude.add(target_dept_id)

        conn = self._connect()
        try:
            # Build placeholders for exclusion
            placeholders = ",".join("?" for _ in exclude)
            # Join target fitness AND source fitness (agent's current queue)
            status_filter = "" if force else "AND a.status = 'available' "
            # When forced (human policy), include all agents but rank available ones first
            order_clause = (
                "(CASE WHEN a.status = 'available' THEN 0 ELSE 1 END), "
                "(ds_target.fitness_score * 0.6 - COALESCE(ds_source.fitness_score, 0) * 0.4) DESC"
                if force else
                "(ds_target.fitness_score * 0.6 - COALESCE(ds_source.fitness_score, 0) * 0.4) DESC"
            )
            rows = conn.execute(
                f"SELECT a.*, "
                f"  ds_target.fitness_score AS target_fitness, "
                f"  COALESCE(ds_source.fitness_score, 0) AS source_fitness "
                f"FROM agents a "
                f"JOIN department_scores ds_target "
                f"  ON a.id = ds_target.agent_id AND ds_target.department_id = ? "
                f"LEFT JOIN department_scores ds_source "
                f"  ON a.id = ds_source.agent_id AND ds_source.department_id = a.current_queue_id "
                f"WHERE a.current_queue_id NOT IN ({placeholders}) "
                f"{status_filter}"
                f"ORDER BY {order_clause}",
                (target_dept_id, *exclude),
            ).fetchall()

            # Count agents per queue for min-staffing enforcement
            queue_counts: dict[str, int] = {}
            for r in conn.execute("SELECT current_queue_id, COUNT(*) as cnt FROM agents GROUP BY current_queue_id"):
                queue_counts[r["current_queue_id"]] = r["cnt"]

            result: list[HumanAgentProfile] = []
            for row in rows:
                if len(result) >= count:
                    break
                # Guardrail: skip agents below minimum fitness threshold (unless forced by human policy)
                if not force and row["target_fitness"] < MIN_FITNESS_THRESHOLD:
                    logger.debug(
                        "Skipping %s for %s — fitness %.2f below threshold %.2f",
                        row["name"], target_dept_id, row["target_fitness"], MIN_FITNESS_THRESHOLD,
                    )
                    continue
                src_q = row["current_queue_id"]
                if force or queue_counts.get(src_q, 0) > min_remaining:
                    result.append(self._row_to_profile(conn, row))
                    queue_counts[src_q] -= 1

            return result
        finally:
            pass  # Connection cached for reuse

    # ── Mutations ────────────────────────────────────────────────────────────

    def check_move_fitness(self, agent_id: str, target_queue_id: str) -> tuple[bool, float, str]:
        """Check if an agent meets the minimum fitness threshold for a target department.

        Returns (allowed, fitness_score, message).
        """
        conn = self._connect()
        try:
            row = conn.execute("SELECT name FROM agents WHERE id = ?", (agent_id,)).fetchone()
            if not row:
                return False, 0.0, f"Agent {agent_id} not found"

            ds = conn.execute(
                "SELECT fitness_score FROM department_scores WHERE agent_id = ? AND department_id = ?",
                (agent_id, target_queue_id),
            ).fetchone()
            fitness = ds["fitness_score"] if ds else 0.0
            dept_name = DEPARTMENT_NAMES.get(target_queue_id, target_queue_id)

            if fitness < MIN_FITNESS_THRESHOLD:
                return (
                    False, fitness,
                    f"BLOCKED: {row['name']} has only {fitness:.0%} fitness for {dept_name} "
                    f"(minimum required: {MIN_FITNESS_THRESHOLD:.0%}). "
                    f"This agent lacks the necessary skills for this department."
                )
            return True, fitness, "OK"
        finally:
            pass  # Connection cached for reuse

    def move_agent(self, agent_id: str, new_queue_id: str, force: bool = False) -> bool:
        """Reassign an agent to a new queue. Persisted to SQLite.

        Blocked if agent fitness for target dept is below MIN_FITNESS_THRESHOLD
        unless force=True (used by AI agents in emergencies).
        """
        # Guardrail check
        if not force:
            allowed, fitness, msg = self.check_move_fitness(agent_id, new_queue_id)
            if not allowed:
                logger.warning("Move blocked: %s", msg)
                return False

        conn = self._connect()
        try:
            row = conn.execute("SELECT name, current_queue_id FROM agents WHERE id = ?", (agent_id,)).fetchone()
            if not row:
                return False

            old_q = row["current_queue_id"]
            conn.execute(
                "UPDATE agents SET current_queue_id = ? WHERE id = ?",
                (new_queue_id, agent_id),
            )
            conn.commit()

            # Get fitness score for logging
            ds = conn.execute(
                "SELECT fitness_score FROM department_scores WHERE agent_id = ? AND department_id = ?",
                (agent_id, new_queue_id),
            ).fetchone()
            fitness = ds["fitness_score"] if ds else 0.0

            logger.info(
                "Moved %s (%s) from %s to %s (fitness: %.2f)",
                row["name"], agent_id, old_q, new_queue_id, fitness,
            )
            return True
        finally:
            pass  # Connection cached for reuse

    def update_status(self, agent_id: str, status: str) -> None:
        """Update a single agent's status (available, busy, on_break)."""
        conn = self._connect()
        try:
            conn.execute("UPDATE agents SET status = ? WHERE id = ?", (status, agent_id))
            conn.commit()
        finally:
            pass  # Connection cached for reuse

    def update_statuses_bulk(self, updates: list[tuple[str, str]]) -> None:
        """Bulk-update agent statuses. Each tuple is (agent_id, status)."""
        conn = self._connect()
        try:
            conn.executemany("UPDATE agents SET status = ? WHERE id = ?", [(s, aid) for aid, s in updates])
            conn.commit()
        finally:
            pass  # Connection cached for reuse

    def reset(self) -> None:
        """Reset all agents to their home queues (called on simulation restart)."""
        conn = self._connect()
        try:
            conn.execute("UPDATE agents SET current_queue_id = home_queue_id, status = 'available'")
            conn.commit()
            logger.info("Agent database reset — all agents returned to home queues")
        finally:
            pass  # Connection cached for reuse

    # ── Backward compat: produce old-style dicts for SkillRouter ─────────────

    def get_available_agents_compat(self) -> list[dict]:
        """Return agents in the old dict format for backward compatibility."""
        conn = self._connect()
        try:
            rows = conn.execute("SELECT * FROM agents WHERE status = 'available'").fetchall()
            result = []
            for row in rows:
                skills = [
                    r["skill_name"]
                    for r in conn.execute(
                        "SELECT skill_name FROM skill_proficiencies "
                        "WHERE agent_id = ? AND proficiency >= 0.3",
                        (row["id"],),
                    )
                ]
                result.append({
                    "id": row["id"],
                    "name": row["name"],
                    "queue_id": row["current_queue_id"],
                    "skills": skills,
                    "experience": row["role"],
                    "perf_score": row["perf_score"],
                })
            return result
        finally:
            pass  # Connection cached for reuse


# Singleton
agent_database = AgentDatabase()
