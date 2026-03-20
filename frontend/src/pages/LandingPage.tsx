import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
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
} from "lucide-react";
import { useRef } from "react";
import ThemeToggle from "@/components/theme/ThemeToggle";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const pillars = [
  {
    icon: LayoutDashboard,
    title: "AI Operations Center",
    desc: "Live AI decision feed with agent reasoning visibility and real-time cost impact tracking.",
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.08)",
  },
  {
    icon: AlertTriangle,
    title: "AI Anomaly Engine",
    desc: "Statistical anomaly detection with predictive prevention and cascade correlation analysis.",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.08)",
  },
  {
    icon: BrainCircuit,
    title: "Autonomous Agents",
    desc: "Queue Balancer, Predictive Prevention, Escalation Handler with multi-agent negotiation.",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.08)",
  },
  {
    icon: MessageSquare,
    title: "Conversational Command",
    desc: "Natural language queries, what-if simulations, and policy creation through chat.",
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.08)",
  },
  {
    icon: FlaskConical,
    title: "Simulation Engine",
    desc: "Built-in demo mode with choreographed scenarios and interactive chaos injection.",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.08)",
  },
  {
    icon: FileBarChart,
    title: "Reports & Analytics",
    desc: "Comprehensive reporting with exportable insights, trend analysis, and governance audit trails.",
    color: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.08)",
  },
];

const stats = [
  { value: "4", label: "AI Agents", icon: Bot },
  { value: "2s", label: "Tick Interval", icon: Zap },
  { value: "5", label: "Queue Monitors", icon: TrendingUp },
  { value: "Live", label: "WebSocket Feed", icon: Network },
];

const workflow = [
  { step: "01", title: "Observe", desc: "Metrics stream in real-time from queues" },
  { step: "02", title: "Analyze", desc: "AI agents detect anomalies & patterns" },
  { step: "03", title: "Decide", desc: "Agents propose actions with confidence scores" },
  { step: "04", title: "Execute", desc: "Approved actions stabilize operations" },
];

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
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                className="landing-stat"
                variants={scaleIn}
                custom={i}
              >
                <s.icon className="landing-stat-icon" />
                <div className="landing-stat-value">{s.value}</div>
                <div className="landing-stat-label">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Hero visual — floating agent cards */}
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
              <span className="landing-mockup-url">sentinelai.cirruslabs.io</span>
            </div>
            <div className="landing-mockup-body">
              {/* Floating agent cards inside the mockup */}
              {[
                { name: "Queue Balancer", status: "Executing", color: "#3b82f6" },
                { name: "Predictive Prevention", status: "Analyzing", color: "#10b981" },
                { name: "Escalation Handler", status: "Observing", color: "#f59e0b" },
              ].map((agent, i) => (
                <motion.div
                  key={agent.name}
                  className="landing-agent-card"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.15, duration: 0.5 }}
                >
                  <div
                    className="landing-agent-dot"
                    style={{ background: agent.color }}
                  />
                  <div className="landing-agent-info">
                    <span className="landing-agent-name">{agent.name}</span>
                    <span className="landing-agent-status" style={{ color: agent.color }}>
                      {agent.status}
                    </span>
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
              <div className="landing-workflow-num">{w.step}</div>
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
          <motion.h2 variants={fadeUp} custom={0} className="landing-section-title">
            Five Pillars of Intelligence
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
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
            >
              <div
                className="landing-pillar-icon"
                style={{ background: p.bg, color: p.color }}
              >
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="landing-pillar-title">{p.title}</h3>
              <p className="landing-pillar-desc">{p.desc}</p>
              <div
                className="landing-pillar-accent"
                style={{ background: p.color }}
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
          <h2 className="landing-cta-title">
            Ready to see autonomous intelligence in action?
          </h2>
          <p className="landing-cta-desc">
            Launch the dashboard and experience SentinelAI with our built-in
            simulation engine — no AWS credentials required.
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
            <Activity className="h-4 w-4 text-[#3b82f6]" />
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
