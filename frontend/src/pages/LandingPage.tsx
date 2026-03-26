import "./LandingPage.css";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Activity,
  BrainCircuit,
  AlertTriangle,
  MessageSquare,
  FlaskConical,
  FileBarChart,
  Shield,
  Zap,
  LayoutDashboard,
  ArrowRight,
  ChevronDown,
  Network,
  CheckCircle2,
  Eye,
  GitBranch,
  Lock,
  Cpu,
  Radio,
  Users,
  Route,
  Layers,
  Target,
  Sparkles,
  Globe,
  ShieldCheck,
  BarChart3,
  MessageCircle,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import ThemeToggle from "@/components/theme/ThemeToggle";

/* -- Animation variants -- */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const slideInLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const slideInRight = {
  hidden: { opacity: 0, x: 60 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

/* -- Data -- */
const pillars = [
  {
    icon: LayoutDashboard,
    title: "AI Operations Center",
    desc: "Live decision feed showing every agent's reasoning chain, cost impact, and governance status in real-time.",
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.08)",
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
  },
  {
    icon: AlertTriangle,
    title: "AI Anomaly Engine",
    desc: "Detects spikes, predicts cascades, and scores anomaly velocity — catching problems minutes before humans notice.",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.08)",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
  },
  {
    icon: BrainCircuit,
    title: "Autonomous Agents",
    desc: "Autonomous AI agents running in parallel via LangGraph — balancing queues, preventing cascades, handling escalations, routing by skill, and analyzing trends.",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.08)",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
  },
  {
    icon: Route,
    title: "Intelligent Skill Router",
    desc: "Proficiency-weighted agent matching across 12 skills and 5 departments with fitness scoring.",
    color: "#ec4899",
    bg: "rgba(236, 72, 153, 0.08)",
    gradient: "linear-gradient(135deg, #ec4899, #db2777)",
  },
  {
    icon: Users,
    title: "Workforce Intelligence",
    desc: "24-agent workforce database with department fitness, skill proficiency tracking, and real-time availability.",
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.08)",
    gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
  },
  {
    icon: MessageSquare,
    title: "Conversational Command",
    desc: "Ask questions in plain English, run what-if simulations, chat with individual agents, and create policies — all through natural language.",
    color: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.08)",
    gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
  },
  {
    icon: FlaskConical,
    title: "Simulation Engine",
    desc: "Choreographed crisis scenarios with live chaos injection — watch agents detect, negotiate, and resolve incidents in real-time.",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.08)",
    gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
  },
  {
    icon: FileBarChart,
    title: "Reports & PDF Export",
    desc: "One-click PDF reports with session analytics, governance audit trails, and workforce performance breakdowns.",
    color: "#14b8a6",
    bg: "rgba(20, 184, 166, 0.08)",
    gradient: "linear-gradient(135deg, #14b8a6, #0d9488)",
  },
  {
    icon: MessageCircle,
    title: "Teams Bot Integration",
    desc: "Microsoft Teams alerts, interactive approval cards, and PDF report delivery via Bot Framework.",
    color: "#6366f1",
    bg: "rgba(99, 102, 241, 0.08)",
    gradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
  },
];

const stats = [
  { value: 3, label: "Second Response", icon: Zap, suffix: "s" },
  { value: 24, label: "Human Agents", icon: Users, suffix: "" },
  { value: 12, label: "Skills Tracked", icon: Target, suffix: "" },
  { value: 5, label: "Departments", icon: Layers, suffix: "" },
  { value: 99.9, label: "Uptime SLA", icon: Network, suffix: "%" },
];

const workflow = [
  { step: "01", title: "Observe", desc: "Every 3 seconds, live metrics stream from all queues", icon: Eye },
  { step: "02", title: "Analyze", desc: "Agents detect anomalies, predict cascades, score risk", icon: Cpu },
  { step: "03", title: "Negotiate", desc: "Conflicting proposals resolve through weighted priority", icon: GitBranch },
  { step: "04", title: "Execute", desc: "High-confidence actions fire instantly — the rest get human review", icon: CheckCircle2 },
];

const agents = [
  {
    name: "Queue Balancer",
    desc: "Detects pressure imbalances and autonomously redistributes agents — turning a 20-minute manual process into a 3-second decision.",
    color: "#3b82f6",
    icon: BarChart3,
    status: "Executing",
    confidence: 0.94,
  },
  {
    name: "Predictive Prevention",
    desc: "Sees problems 60 seconds before they hit — tracking velocity, correlating cross-queue patterns, and scaling preemptively.",
    color: "#10b981",
    icon: Shield,
    status: "Analyzing",
    confidence: 0.87,
  },
  {
    name: "Escalation Handler",
    desc: "Takes command during crises — pulling emergency resources, paging supervisors, and executing recovery plans autonomously.",
    color: "#f59e0b",
    icon: AlertTriangle,
    status: "Watching",
    confidence: 0.91,
  },
  {
    name: "Skill Router",
    desc: "Matches every interaction to the best-fit agent using proficiency-weighted scoring across 12 skills and 5 departments.",
    color: "#ec4899",
    icon: Route,
    status: "Routing",
    confidence: 0.96,
  },
  {
    name: "Analytics",
    desc: "Answers any question about your operations in plain English — with real numbers, trend analysis, and cost breakdowns.",
    color: "#8b5cf6",
    icon: Sparkles,
    status: "Ready",
    confidence: 0.99,
  },
];

const techStack: { name: string; logo: string; logoDark?: string; wide: boolean | string }[] = [
  { name: "AWS Bedrock", logo: "/logos/aws.svg", wide: true },
  { name: "Anthropic Claude", logo: "/logos/anthropic.svg", wide: false },
  { name: "LangGraph", logo: "/logos/langgraph.svg", wide: false },
  { name: "FastAPI", logo: "/logos/fastapi.svg", wide: false },
  { name: "React", logo: "/logos/react.svg", wide: false },
  { name: "WebSocket", logo: "/logos/websocket.svg", wide: false },
  { name: "MS Teams", logo: "/logos/teams.svg", wide: false },
  { name: "SQLite", logo: "/logos/sqlite.svg", wide: false },
  { name: "RAIA", logo: "/logos/raia.webp", wide: "sm" },
  { name: "LockThreat", logo: "/logos/lockthreat.svg", logoDark: "/logos/lockthreat-dark.svg", wide: true },
];

const liveLogEntries = [
  { time: "12:04:32", agent: "Queue Balancer", action: "Rebalanced 12 agents across Support queue", type: "success" },
  { time: "12:04:30", agent: "Anomaly Engine", action: "Spike detected: Support queue depth 4.2x baseline", type: "warning" },
  { time: "12:04:28", agent: "Skill Router", action: "Matched 3 calls to agents with 0.92+ proficiency scores", type: "success" },
  { time: "12:04:25", agent: "Escalation Handler", action: "3 critical tickets auto-routed to best-fit Tier 2 agents", type: "success" },
  { time: "12:04:22", agent: "Predictive Prevention", action: "Cascade risk elevated to 0.78 --- preemptive scaling triggered", type: "info" },
  { time: "12:04:18", agent: "Skill Router", action: "Agent Sarah Chen (fitness 0.94) assigned to Billing queue", type: "info" },
  { time: "12:04:15", agent: "Queue Balancer", action: "Negotiating with Escalation Handler on priority allocation", type: "info" },
  { time: "12:04:12", agent: "Anomaly Engine", action: "Baseline recalibrated --- new normal established", type: "success" },
];

const guardrailLevels = [
  { label: "Auto-Approve", range: ">= 0.9", color: "#10b981", width: "30%", desc: "Instant execution" },
  { label: "Human Review", range: "0.7 - 0.9", color: "#f59e0b", width: "40%", desc: "30s auto-approve" },
  { label: "Blocked", range: "< 0.7", color: "#ef4444", width: "30%", desc: "Requires override" },
];

/* -- Animated counter hook -- */
function useCounter(target: number, duration = 2000, decimals = 0) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Number(start.toFixed(decimals)));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [started, target, duration, decimals]);

  return { count, start: () => setStarted(true) };
}

function AnimatedStat({ value, label, icon: Icon, suffix }: { value: number; label: string; icon: any; suffix: string }) {
  const decimals = value % 1 !== 0 ? 1 : 0;
  const { count, start } = useCounter(value, 1500, decimals);

  return (
    <motion.div
      className="landing-stat"
      variants={scaleIn}
      onViewportEnter={start}
      viewport={{ once: true }}
    >
      <Icon className="landing-stat-icon" />
      <div className="landing-stat-value">
        {count}{suffix}
      </div>
      <div className="landing-stat-label">{label}</div>
    </motion.div>
  );
}

/* -- Live log component -- */
function LiveAgentLog() {
  const [visibleEntries, setVisibleEntries] = useState<number[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    liveLogEntries.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setVisibleEntries(prev => [...prev, i]);
      }, 1200 + i * 500));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="landing-live-log">
      <div className="landing-live-log-header">
        <Radio className="h-3 w-3 landing-live-pulse" />
        <span>Live Agent Feed</span>
        <span className="landing-live-count">{visibleEntries.length} events</span>
      </div>
      <div className="landing-live-log-body">
        <AnimatePresence>
          {visibleEntries.map(i => {
            const entry = liveLogEntries[i]!;
            return (
              <motion.div
                key={i}
                className={`landing-log-entry landing-log-${entry.type}`}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <span className="landing-log-time">{entry.time}</span>
                <span className="landing-log-agent">{entry.agent}</span>
                <span className="landing-log-action">{entry.action}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* -- Orbiting dots for hero -- */
function OrbitingDots() {
  return (
    <div className="landing-orbit-container" aria-hidden="true">
      <div className="landing-orbit-ring landing-orbit-ring-1">
        <div className="landing-orbit-dot" style={{ background: "#3b82f6" }} />
      </div>
      <div className="landing-orbit-ring landing-orbit-ring-2">
        <div className="landing-orbit-dot" style={{ background: "#10b981" }} />
      </div>
      <div className="landing-orbit-ring landing-orbit-ring-3">
        <div className="landing-orbit-dot" style={{ background: "#f59e0b" }} />
      </div>
      <div className="landing-orbit-ring landing-orbit-ring-4">
        <div className="landing-orbit-dot" style={{ background: "#ec4899" }} />
      </div>
      <div className="landing-orbit-ring landing-orbit-ring-5">
        <div className="landing-orbit-dot" style={{ background: "#8b5cf6" }} />
      </div>
      <div className="landing-orbit-center">
        <BrainCircuit className="h-6 w-6" />
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.12], [1, 0.97]);

  return (
    <div className="landing-root">
      {/* Animated background */}
      <div className="landing-bg" aria-hidden="true">
        <div className="landing-blob landing-blob-1" />
        <div className="landing-blob landing-blob-2" />
        <div className="landing-blob landing-blob-3" />
        <div className="landing-blob landing-blob-4" />
        <div className="landing-grid-pattern" />
      </div>

      {/* Navbar */}
      <motion.nav
        className="landing-nav"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="landing-nav-inner">
          <div className="landing-nav-brand">
            <div className="landing-nav-logo">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="landing-nav-wordmark">
              Sentinel<span className="text-[#3b82f6]">AI</span>
            </span>
            <span className="landing-nav-sub">
              by <span className="text-[#475569] font-semibold">Cirrus</span><span className="text-[#f87171] font-semibold">Labs</span>
            </span>
          </div>
          <div className="landing-nav-actions">
            <ThemeToggle />
            <button
              onClick={() => navigate("/login")}
              className="landing-btn-ghost"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate("/login")}
              className="landing-btn-primary"
            >
              Launch Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <motion.section
        ref={heroRef}
        className="landing-hero"
        style={{ opacity: heroOpacity, scale: heroScale }}
      >
        <div className="landing-hero-orb" aria-hidden="true" />

        <motion.div
          className="landing-hero-content"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div variants={fadeUp} custom={0} className="landing-hero-pills-row">
            <div className="landing-hero-pill">
              <Shield className="h-3.5 w-3.5" />
              Autonomous AI Contact Center Intelligence
            </div>
            <div className="landing-hero-pill-sm landing-hero-pill-raia">
              <img src="/logos/raia.webp" alt="RAIA" />
              RAIA Evaluated
            </div>
            <div className="landing-hero-pill-sm landing-hero-pill-lockthreat">
              <img src="/logos/lockthreat.svg" alt="LockThreat" className="landing-logo-light" />
              <img src="/logos/lockthreat-dark.svg" alt="LockThreat" className="landing-logo-dark" />
              LockThreat Compatible
            </div>
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className="landing-hero-title">
            Your Contact Center,{" "}
            <span className="landing-gradient-text">Autonomously Optimized</span>
          </motion.h1>

          <motion.p variants={fadeUp} custom={1.5} className="landing-hero-byline">
            by <span className="landing-hero-byline-cirrus">Cirrus</span><span className="landing-hero-byline-labs">Labs</span>
          </motion.p>

          <motion.p variants={fadeUp} custom={2} className="landing-hero-subtitle">
            SentinelAI deploys autonomous AI agents that monitor, analyze, and optimize
            your AWS Connect queues in real-time — detecting anomalies before they cascade,
            negotiating actions across agents, and resolving incidents in seconds, not minutes.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="landing-hero-actions">
            <button
              onClick={() => navigate("/login")}
              className="landing-btn-hero"
            >
              Get Started
              <ArrowRight className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="landing-btn-outline"
            >
              Explore Features
              <ChevronDown className="h-4 w-4" />
            </button>
          </motion.div>

          {/* Stats bar */}
          <motion.div variants={fadeUp} custom={4} className="landing-stats">
            {stats.map((s) => (
              <AnimatedStat key={s.label} {...s} />
            ))}
          </motion.div>
        </motion.div>

        {/* Hero visual -- orbiting agents */}
        <motion.div
          className="landing-hero-visual"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="landing-mockup">
            <div className="landing-mockup-bar">
              <div className="landing-mockup-dots">
                <span /><span /><span />
              </div>
              <span className="landing-mockup-url">
                <Lock className="h-3 w-3" style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                sentinelai.cirruslabs.io
              </span>
            </div>
            <div className="landing-mockup-body">
              {agents.slice(0, 4).map((agent, i) => (
                <motion.div
                  key={agent.name}
                  className="landing-agent-card"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.15, duration: 0.5 }}
                >
                  <div className="landing-agent-dot-ring" style={{ color: agent.color }}>
                    <div
                      className="landing-agent-dot"
                      style={{ background: agent.color }}
                    />
                  </div>
                  <div className="landing-agent-info">
                    <span className="landing-agent-name">{agent.name}</span>
                    <span className="landing-agent-status" style={{ color: agent.color }}>
                      {agent.status}
                    </span>
                  </div>
                  <div className="landing-agent-confidence">
                    <div className="landing-confidence-bar">
                      <motion.div
                        className="landing-confidence-fill"
                        style={{ background: agent.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${agent.confidence * 100}%` }}
                        transition={{ delay: 1.0 + i * 0.15, duration: 0.8 }}
                      />
                    </div>
                    <span className="landing-confidence-label">{(agent.confidence * 100).toFixed(0)}%</span>
                  </div>
                </motion.div>
              ))}
              {/* Animated metric bars */}
              <div className="landing-mockup-metrics">
                {[65, 82, 45, 91, 73].map((w, i) => (
                  <motion.div
                    key={i}
                    className="landing-metric-bar"
                    initial={{ width: 0 }}
                    animate={{ width: `${w}%` }}
                    transition={{ delay: 1.2 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* Tech stack ribbon */}
      <section className="landing-tech-ribbon">
        <div className="landing-tech-label">Built on</div>
        <div className="landing-tech-scroll">
          <div className="landing-tech-track">
            {[...techStack, ...techStack].map((tech, i) => (
              <div key={i} className="landing-tech-item">
                <img src={tech.logo} alt={tech.name} className={`${(tech.wide as any) === "sm" ? "landing-tech-logo-wide-sm" : tech.wide ? "landing-tech-logo-wide" : "landing-tech-logo"}${tech.logoDark ? " landing-logo-light" : ""}`} />
                {tech.logoDark && <img src={tech.logoDark} alt={tech.name} className={`${(tech.wide as any) === "sm" ? "landing-tech-logo-wide-sm" : tech.wide ? "landing-tech-logo-wide" : "landing-tech-logo"} landing-logo-dark`} />}
                <span className="landing-tech-name">{tech.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agents showcase */}
      <section className="landing-section" id="agents">
        <motion.div
          className="landing-section-header"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} custom={0} className="landing-section-badge">
            Multi-Agent Architecture
          </motion.div>
          <motion.h2 variants={fadeUp} custom={0.5} className="landing-section-title">
            Autonomous Agents, One Orchestrator
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="landing-section-desc">
            Powered by LangGraph, our agents run in parallel — negotiating conflicts,
            enforcing guardrails, and explaining every decision they make.
          </motion.p>
        </motion.div>

        <motion.div
          className="landing-agents-showcase"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          <div className="landing-agents-orbit-side">
            <OrbitingDots />
          </div>
          <div className="landing-agents-list">
            {agents.map((agent, i) => (
              <motion.div
                key={agent.name}
                className="landing-agent-showcase-card"
                variants={slideInRight}
                custom={i}
                whileHover={{ x: 8, transition: { duration: 0.2 } }}
              >
                <div
                  className="landing-agent-showcase-icon"
                  style={{ background: `${agent.color}15`, color: agent.color }}
                >
                  <agent.icon className="h-5 w-5" />
                </div>
                <div className="landing-agent-showcase-content">
                  <div className="landing-agent-showcase-header">
                    <h3 className="landing-agent-showcase-name">{agent.name}</h3>
                    <span
                      className="landing-agent-showcase-status"
                      style={{ background: `${agent.color}15`, color: agent.color }}
                    >
                      {agent.confidence * 100}% confidence
                    </span>
                  </div>
                  <p className="landing-agent-showcase-desc">{agent.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Guardrails section */}
      <section className="landing-section">
        <motion.div
          className="landing-section-header"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} custom={0} className="landing-section-badge">
            Safety First
          </motion.div>
          <motion.h2 variants={fadeUp} custom={0.5} className="landing-section-title">
            Confidence-Based Guardrails
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="landing-section-desc">
            Every agent action carries a confidence score. High-confidence decisions execute instantly.
            Low-confidence ones require human approval. Nothing runs unchecked.
          </motion.p>
        </motion.div>

        <motion.div
          className="landing-guardrails"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          {guardrailLevels.map((g, i) => (
            <motion.div
              key={g.label}
              className="landing-guardrail-card"
              variants={scaleIn}
              custom={i}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div
                className="landing-guardrail-indicator"
                style={{ background: g.color }}
              />
              <div className="landing-guardrail-content">
                <h3 className="landing-guardrail-title" style={{ color: g.color }}>
                  {g.label}
                </h3>
                <div className="landing-guardrail-range">{g.range}</div>
                <p className="landing-guardrail-desc">{g.desc}</p>
              </div>
              <motion.div
                className="landing-guardrail-bar"
                style={{ background: `${g.color}20` }}
                initial={{ width: 0 }}
                whileInView={{ width: "100%" }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.8 }}
              >
                <motion.div
                  className="landing-guardrail-fill"
                  style={{ background: g.color }}
                  initial={{ width: 0 }}
                  whileInView={{ width: g.width }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.15, duration: 1 }}
                />
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Live Agent Feed section */}
      <section className="landing-section">
        <motion.div
          className="landing-section-header"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} custom={0} className="landing-section-title">
            Real-Time Agent Intelligence
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="landing-section-desc">
            Watch agents think, negotiate, and act — every decision logged with full reasoning chains and audit trails.
          </motion.p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <LiveAgentLog />
        </motion.div>
      </section>

      {/* How it works */}
      <section className="landing-section">
        <motion.div
          className="landing-section-header"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} custom={0} className="landing-section-title">
            How It Works
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="landing-section-desc">
            From anomaly detection to resolution in seconds — a closed-loop autonomous pipeline.
          </motion.p>
        </motion.div>

        <motion.div
          className="landing-workflow"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          {workflow.map((w, i) => (
            <motion.div
              key={w.step}
              className="landing-workflow-step"
              variants={fadeUp}
              custom={i}
            >
              <div className="landing-workflow-num">
                <w.icon className="h-5 w-5" />
              </div>
              {i < workflow.length - 1 && <div className="landing-workflow-connector" />}
              <div className="landing-workflow-line" />
              <h3 className="landing-workflow-title">{w.title}</h3>
              <p className="landing-workflow-desc">{w.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Feature Pillars */}
      <section id="features" className="landing-section">
        <motion.div
          className="landing-section-header"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} custom={0} className="landing-section-badge">
            Core Capabilities
          </motion.div>
          <motion.h2 variants={fadeUp} custom={0.5} className="landing-section-title">
            The Full Intelligence Stack
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="landing-section-desc">
            Every capability an autonomous contact center needs — from anomaly detection to compliance reporting.
          </motion.p>
        </motion.div>

        <motion.div
          className="landing-pillars"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              className="landing-pillar-card"
              variants={scaleIn}
              custom={i}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
            >
              <div className="landing-pillar-glow" style={{ background: p.gradient, opacity: 0 }} />
              <div
                className="landing-pillar-icon"
                style={{ background: p.bg, color: p.color }}
              >
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="landing-pillar-title">{p.title}</h3>
              <p className="landing-pillar-desc">{p.desc}</p>
              <div
                className="landing-pillar-accent"
                style={{ background: p.gradient }}
              />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Architecture / Workforce split */}
      <section className="landing-section">
        <motion.div
          className="landing-split"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.div className="landing-split-content" variants={slideInLeft} custom={0}>
            <div className="landing-section-badge" style={{ marginBottom: 16 }}>Workforce Intelligence</div>
            <h2 className="landing-split-title">
              Know Your Agents Better Than They Know Themselves
            </h2>
            <p className="landing-split-desc">
              24 human agents, 5 departments, 12 skills — all scored by a fitness algorithm that
              combines skill match, experience, and real-time performance to route every interaction
              to the right person, every time.
            </p>
            <div className="landing-split-features">
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#10b981" }} />
                <span>Proficiency-weighted routing</span>
              </div>
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#10b981" }} />
                <span>Department fitness scoring</span>
              </div>
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#10b981" }} />
                <span>Real-time availability tracking</span>
              </div>
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#10b981" }} />
                <span>Named agent moves via chat</span>
              </div>
            </div>
          </motion.div>

          <motion.div className="landing-split-visual" variants={slideInRight} custom={1}>
            <div className="landing-workforce-preview">
              <div className="landing-workforce-header">
                <Users className="h-4 w-4" />
                <span>Workforce Overview</span>
              </div>
              {[
                { name: "Sarah Chen", dept: "Support", fitness: 0.94, skills: ["Technical Support", "Billing"], status: "Available" },
                { name: "Marcus Johnson", dept: "Sales", fitness: 0.91, skills: ["Product Knowledge", "Negotiation"], status: "On Call" },
                { name: "Priya Patel", dept: "Technical", fitness: 0.88, skills: ["Troubleshooting", "Escalation"], status: "Available" },
                { name: "James Wilson", dept: "Billing", fitness: 0.85, skills: ["Account Management", "Retention"], status: "Break" },
              ].map((agent, i) => (
                <motion.div
                  key={agent.name}
                  className="landing-workforce-row"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                >
                  <div className="landing-workforce-agent">
                    <div className="landing-workforce-avatar" style={{
                      background: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"][i],
                    }}>
                      {agent.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <div className="landing-workforce-name">{agent.name}</div>
                      <div className="landing-workforce-dept">{agent.dept}</div>
                    </div>
                  </div>
                  <div className="landing-workforce-skills">
                    {agent.skills.map(s => (
                      <span key={s} className="landing-workforce-skill">{s}</span>
                    ))}
                  </div>
                  <div className="landing-workforce-fitness">
                    <div className="landing-workforce-fitness-bar">
                      <motion.div
                        className="landing-workforce-fitness-fill"
                        style={{ background: agent.fitness > 0.9 ? "#10b981" : agent.fitness > 0.85 ? "#f59e0b" : "#3b82f6" }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${agent.fitness * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
                      />
                    </div>
                    <span className="landing-workforce-fitness-label">{(agent.fitness * 100).toFixed(0)}%</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Teams + Integration split */}
      <section className="landing-section">
        <motion.div
          className="landing-split landing-split-reverse"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.div className="landing-split-visual" variants={slideInLeft} custom={0}>
            <div className="landing-integration-preview">
              <div className="landing-integration-card landing-integration-teams">
                <div className="landing-integration-icon">
                  <Globe className="h-5 w-5" />
                </div>
                <h4>Microsoft Teams</h4>
                <p>Approval cards, alerts, and PDF reports delivered directly to your Teams channels.</p>
                <div className="landing-integration-dots">
                  <span style={{ background: "#3b82f6" }} />
                  <span style={{ background: "#10b981" }} />
                  <span style={{ background: "#f59e0b" }} />
                </div>
              </div>
              <div className="landing-integration-card landing-integration-ws">
                <div className="landing-integration-icon">
                  <Zap className="h-5 w-5" />
                </div>
                <h4>WebSocket + SSE</h4>
                <p>Real-time updates with automatic fallback from WebSocket to Server-Sent Events.</p>
                <div className="landing-integration-pulse" />
              </div>
              <div className="landing-integration-card landing-integration-pdf">
                <div className="landing-integration-icon">
                  <FileBarChart className="h-5 w-5" />
                </div>
                <h4>PDF Reports</h4>
                <p>Paginated governance reports with workforce analytics and trend charts.</p>
                <div className="landing-integration-lines">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div className="landing-split-content" variants={slideInRight} custom={1}>
            <div className="landing-section-badge" style={{ marginBottom: 16 }}>Integrations</div>
            <h2 className="landing-split-title">
              Connected Everywhere That Matters
            </h2>
            <p className="landing-split-desc">
              Microsoft Teams approval workflows, real-time WebSocket feeds, and
              exportable PDF governance reports — SentinelAI plugs into your
              existing operations stack with zero friction.
            </p>
            <div className="landing-split-features">
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#10b981" }} />
                <span>Teams Bot with interactive approval cards</span>
              </div>
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#10b981" }} />
                <span>WebSocket with SSE + HTTP fallbacks</span>
              </div>
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#10b981" }} />
                <span>Exportable PDF governance reports</span>
              </div>
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#10b981" }} />
                <span>AWS Bedrock with 3-tier LLM fallback</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Enterprise Compliance — RAIA & LockThreat */}
      <section className="landing-section" id="compliance">
        <motion.div
          className="landing-section-header"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} custom={0} className="landing-section-badge">
            Enterprise Compliance
          </motion.div>
          <motion.h2 variants={fadeUp} custom={0.5} className="landing-section-title">
            Built on CirrusLabs Compliance Stack
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="landing-section-desc">
            Every AI decision is traced, evaluated, and auditable — powered by CirrusLabs' own compliance platforms.
          </motion.p>
        </motion.div>

        <motion.div
          className="landing-compliance-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          {/* RAIA Card */}
          <motion.div className="landing-compliance-card landing-compliance-raia" variants={slideInLeft} custom={0}>
            <div className="landing-compliance-header">
              <img src="/logos/raia.webp" alt="RAIA" className="landing-compliance-logo" />
              <div>
                <h3 className="landing-compliance-name">RAIA</h3>
                <p className="landing-compliance-subtitle">Responsible & Explainable AI --- Trust & Transparency</p>
              </div>
            </div>
            <div className="landing-compliance-direction landing-compliance-direction-push">
              <ArrowRight className="h-3 w-3" />
              Every AI decision traced & evaluated for explainability
            </div>
            <div className="landing-compliance-features">
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#ec4899" }} />
                <span>Every agent decision traced with full reasoning chain</span>
              </div>
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#ec4899" }} />
                <span>Confidence scores, tool authorizations, boundary violations logged</span>
              </div>
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#ec4899" }} />
                <span>Traces uploaded to RAIA dashboard for explainability evaluation</span>
              </div>
            </div>
            <div className="landing-compliance-checks">
              {["Explainability", "Fairness", "Traceability", "Tool Auth", "Boundary Compliance", "Escalation Protocol"].map(check => (
                <div key={check} className="landing-compliance-check">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {check}
                </div>
              ))}
            </div>
          </motion.div>

          {/* LockThreat Card */}
          <motion.div className="landing-compliance-card landing-compliance-lockthreat" variants={slideInRight} custom={1}>
            <div className="landing-compliance-header">
              <img src="/logos/lockthreat.svg" alt="LockThreat" className="landing-compliance-logo landing-logo-light" />
              <img src="/logos/lockthreat-dark.svg" alt="LockThreat" className="landing-compliance-logo landing-logo-dark" />
              <div>
                <h3 className="landing-compliance-name">LockThreat</h3>
                <p className="landing-compliance-subtitle">Governance, Risk & Compliance</p>
              </div>
            </div>
            <div className="landing-compliance-direction landing-compliance-direction-expose">
              <ArrowRight className="h-3 w-3" />
              LockThreat Compatible
            </div>
            <div className="landing-compliance-features">
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#f59e0b" }} />
                <span>Map guardrail metrics to SOC 2, ISO 27001, NIST AI RMF</span>
              </div>
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#f59e0b" }} />
                <span>Continuous GRC monitoring across AI agent decisions</span>
              </div>
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#f59e0b" }} />
                <span>Automated policy checks with real-time compliance scoring</span>
              </div>
              <div className="landing-split-feature">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#f59e0b" }} />
                <span>Enterprise audit trail and risk reporting</span>
              </div>
            </div>
            <div className="landing-framework-badges">
              <div className="landing-framework-badge landing-framework-soc2">
                <span className="landing-framework-badge-name">SOC 2 Type II</span>
                <span className="landing-framework-badge-count">14 controls</span>
              </div>
              <div className="landing-framework-badge landing-framework-iso">
                <span className="landing-framework-badge-name">ISO 27001</span>
                <span className="landing-framework-badge-count">10 controls</span>
              </div>
              <div className="landing-framework-badge landing-framework-nist">
                <span className="landing-framework-badge-name">NIST AI RMF</span>
                <span className="landing-framework-badge-count">8 controls</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="landing-section">
        <motion.div
          className="landing-cta"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="landing-cta-glow" aria-hidden="true" />
          <div className="landing-cta-glow-2" aria-hidden="true" />
          <h2 className="landing-cta-title">

            See What Autonomous AI Looks Like
          </h2>
          <p className="landing-cta-desc">
            Launch the dashboard, start the simulation, and watch AI agents
            detect, negotiate, and resolve a live crisis — zero setup required.
          </p>
          <div className="landing-cta-actions">
            <button onClick={() => navigate("/login")} className="landing-btn-hero">
              Launch Dashboard
              <ArrowRight className="h-4.5 w-4.5" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-nav-logo" style={{ width: 28, height: 28, borderRadius: 8 }}>
              <Activity className="h-3.5 w-3.5 text-white" />
            </div>
            <span>
              Sentinel<span className="text-[#3b82f6]">AI</span>
            </span>
          </div>
          <p className="landing-footer-copy">
            Built by <span className="font-semibold text-[#475569]">Cirrus<span className="text-[#f87171]">Labs</span></span> --- Autonomous AI for Enterprise Operations
          </p>
        </div>
      </footer>
    </div>
  );
}
