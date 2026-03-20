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
  Bot,
  Network,
  TrendingUp,
  CheckCircle2,
  Eye,
  GitBranch,
  Lock,
  Cpu,
  Radio,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import ThemeToggle from "@/components/theme/ThemeToggle";

/* ── Animation variants ── */
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

/* ── Data ── */
const pillars = [
  {
    icon: LayoutDashboard,
    title: "AI Operations Center",
    desc: "Live AI decision feed with agent reasoning visibility and real-time cost impact tracking.",
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.08)",
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
  },
  {
    icon: AlertTriangle,
    title: "AI Anomaly Engine",
    desc: "Statistical anomaly detection with predictive prevention and cascade correlation analysis.",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.08)",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
  },
  {
    icon: BrainCircuit,
    title: "Autonomous Agents",
    desc: "Queue Balancer, Predictive Prevention, Escalation Handler with multi-agent negotiation.",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.08)",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
  },
  {
    icon: MessageSquare,
    title: "Conversational Command",
    desc: "Natural language queries, what-if simulations, and policy creation through chat.",
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.08)",
    gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
  },
  {
    icon: FlaskConical,
    title: "Simulation Engine",
    desc: "Built-in demo mode with choreographed scenarios and interactive chaos injection.",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.08)",
    gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
  },
  {
    icon: FileBarChart,
    title: "Reports & Analytics",
    desc: "Comprehensive reporting with exportable insights, trend analysis, and governance audit trails.",
    color: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.08)",
    gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
  },
];

const stats = [
  { value: 4, label: "AI Agents", icon: Bot, suffix: "" },
  { value: 2, label: "Tick Interval", icon: Zap, suffix: "s" },
  { value: 5, label: "Queue Monitors", icon: TrendingUp, suffix: "" },
  { value: 99.9, label: "Uptime SLA", icon: Network, suffix: "%" },
];

const workflow = [
  { step: "01", title: "Observe", desc: "Metrics stream in real-time from queues", icon: Eye },
  { step: "02", title: "Analyze", desc: "AI agents detect anomalies & patterns", icon: Cpu },
  { step: "03", title: "Decide", desc: "Agents propose actions with confidence scores", icon: GitBranch },
  { step: "04", title: "Execute", desc: "Approved actions stabilize operations", icon: CheckCircle2 },
];

const techStack = [
  { name: "Google Gemini", logo: "/logos/gemini.svg" },
  { name: "Anthropic Claude", logo: "/logos/anthropic.svg" },
  { name: "AWS", logo: "/logos/aws.svg" },
  { name: "FastAPI", logo: "/logos/fastapi.svg" },
  { name: "React", logo: "/logos/react.svg" },
  { name: "WebSocket", logo: "/logos/websocket.svg" },
];

const liveLogEntries = [
  { time: "12:04:32", agent: "Queue Balancer", action: "Rebalanced 12 agents across Support queue", type: "success" },
  { time: "12:04:30", agent: "Anomaly Engine", action: "Spike detected: Support queue depth 4.2x baseline", type: "warning" },
  { time: "12:04:28", agent: "Predictive Prevention", action: "Cascade risk elevated to 0.78 — preemptive scaling", type: "info" },
  { time: "12:04:25", agent: "Escalation Handler", action: "3 critical tickets auto-routed to Tier 2", type: "success" },
  { time: "12:04:22", agent: "Queue Balancer", action: "Negotiating with Escalation Handler on priority", type: "info" },
  { time: "12:04:18", agent: "Anomaly Engine", action: "Baseline recalibrated — new normal established", type: "success" },
];

/* ── Animated counter hook ── */
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

/* ── Live log component ── */
function LiveAgentLog() {
  const [visibleEntries, setVisibleEntries] = useState<number[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    liveLogEntries.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setVisibleEntries(prev => [...prev, i]);
      }, 1200 + i * 600));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="landing-live-log">
      <div className="landing-live-log-header">
        <Radio className="h-3 w-3 landing-live-pulse" />
        <span>Live Agent Feed</span>
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

export default function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.97]);

  return (
    <div className="landing-root">
      {/* Animated background blobs */}
      <div className="landing-bg" aria-hidden="true">
        <div className="landing-blob landing-blob-1" />
        <div className="landing-blob landing-blob-2" />
        <div className="landing-blob landing-blob-3" />
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
        {/* Hero glow orb */}
        <div className="landing-hero-orb" aria-hidden="true" />

        <motion.div
          className="landing-hero-content"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div variants={fadeUp} custom={0} className="landing-hero-pill">
            <Shield className="h-3.5 w-3.5" />
            Autonomous AI Contact Center Intelligence
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className="landing-hero-title">
            Your Contact Center,{" "}
            <span className="landing-gradient-text">Autonomously Optimized</span>
          </motion.h1>

          <motion.p variants={fadeUp} custom={1.5} className="landing-hero-byline">
            by <span className="landing-hero-byline-cirrus">Cirrus</span><span className="landing-hero-byline-labs">Labs</span>
          </motion.p>

          <motion.p variants={fadeUp} custom={2} className="landing-hero-subtitle">
            SentinelAI deploys autonomous agents that monitor, analyze, and optimize
            your AWS Connect queues in real-time — detecting anomalies before they
            cascade and resolving issues without human intervention.
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

        {/* Hero visual — live agent feed */}
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
              {/* Floating agent status cards */}
              {[
                { name: "Queue Balancer", status: "Executing", color: "#3b82f6", confidence: 0.94 },
                { name: "Predictive Prevention", status: "Analyzing", color: "#10b981", confidence: 0.87 },
                { name: "Escalation Handler", status: "Observing", color: "#f59e0b", confidence: 0.72 },
              ].map((agent, i) => (
                <motion.div
                  key={agent.name}
                  className="landing-agent-card"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.15, duration: 0.5 }}
                >
                  <div className="landing-agent-dot-ring">
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
                <img src={tech.logo} alt={tech.name} className="landing-tech-logo" />
                <span className="landing-tech-name">{tech.name}</span>
              </div>
            ))}
          </div>
        </div>
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
            Watch autonomous agents make decisions in real-time. Every action is logged, reasoned, and auditable.
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
            From observation to execution in seconds — a fully autonomous loop.
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

      {/* Five Pillars */}
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
            Six Pillars of Intelligence
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="landing-section-desc">
            A comprehensive autonomous operations layer built on top of AWS Connect.
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
            Ready to see autonomous intelligence in action?
          </h2>
          <p className="landing-cta-desc">
            Launch the dashboard and experience SentinelAI with our built-in
            simulation engine — full demo mode, zero setup.
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
            Built by <span className="font-semibold text-[#475569]">Cirrus<span className="text-[#f87171]">Labs</span></span> — Enterprise AI Strategy & Compliance
          </p>
        </div>
      </footer>
    </div>
  );
}
