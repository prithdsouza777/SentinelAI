import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ShieldCheck,
  Activity,
  BrainCircuit,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  Zap,
  BarChart3,
  Shield,
  Route,
  Sparkles,
} from "lucide-react";
import {
  clearSessionToken,
  createMockToken,
  getValidSession,
  setSessionToken,
} from "@/components/auth/authToken";

import "./LoginPage.css";

const DEMO_EMAIL = "demo@sentinelai.com";
const DEMO_PASSWORD = "demo1234";

const agentTags = [
  { name: "Queue Balancer", color: "#3b82f6", icon: BarChart3 },
  { name: "Predictive Prevention", color: "#10b981", icon: Shield },
  { name: "Escalation Handler", color: "#f59e0b", icon: Zap },
  { name: "Skill Router", color: "#ec4899", icon: Route },
  { name: "Analytics", color: "#8b5cf6", icon: Sparkles },
];

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const existingSession = useMemo(() => getValidSession(), []);

  useEffect(() => {
    if (existingSession) navigate("/dashboard", { replace: true });
  }, []);

  const signIn = (nextEmail: string, nextPassword: string) => {
    const ok = nextEmail === DEMO_EMAIL && nextPassword === DEMO_PASSWORD;
    if (!ok) {
      setError("Invalid credentials");
      return;
    }

    setError(null);
    clearSessionToken();
    const token = createMockToken(nextEmail, "Supervisor");
    setSessionToken(token);
    navigate("/dashboard", { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      signIn(email.trim(), password);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoMode = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    signIn(DEMO_EMAIL, DEMO_PASSWORD);
  };

  return (
    <div className="login-page-root">
      {/* Animated background */}
      <div className="login-bg" aria-hidden="true">
        <div className="login-blob login-blob-1" />
        <div className="login-blob login-blob-2" />
        <div className="login-blob login-blob-3" />
        <div className="login-blob login-blob-4" />
        <div className="login-grid-pattern" />
      </div>

      {/* Left panel - branding showcase */}
      <div className="login-showcase">
        <div className="login-showcase-orb" aria-hidden="true" />

        <div className="login-showcase-content">
          <div className="login-showcase-pill">
            <Shield className="h-3.5 w-3.5" />
            Autonomous AI Contact Center Intelligence
          </div>

          <div className="login-showcase-logo">
            <Activity className="h-5 w-5 text-white" />
          </div>

          <div className="login-showcase-wordmark">
            Sentinel<span className="login-showcase-wordmark-accent">AI</span>
          </div>

          <div className="login-showcase-byline">
            by <span className="login-showcase-byline-cirrus">Cirrus</span>
            <span className="login-showcase-byline-labs">Labs</span>
          </div>

          <p className="login-showcase-desc">
            Five autonomous agents monitor, analyze, and optimize your contact
            center queues in real-time — detecting anomalies before they cascade.
          </p>

          {/* Orbiting visual */}
          <div className="login-orbit-wrap" aria-hidden="true">
            <div className="login-orbit-ring login-orbit-ring-1">
              <div className="login-orbit-dot" style={{ background: "#3b82f6", color: "#3b82f6" }} />
            </div>
            <div className="login-orbit-ring login-orbit-ring-2">
              <div className="login-orbit-dot" style={{ background: "#10b981", color: "#10b981" }} />
            </div>
            <div className="login-orbit-ring login-orbit-ring-3">
              <div className="login-orbit-dot" style={{ background: "#f59e0b", color: "#f59e0b" }} />
            </div>
            <div className="login-orbit-center">
              <BrainCircuit className="h-5 w-5" />
            </div>
          </div>

          {/* Agent tags */}
          <div className="login-float-tags">
            {agentTags.map((agent) => (
              <div key={agent.name} className="login-float-tag">
                <div
                  className="login-float-tag-dot"
                  style={{ background: agent.color }}
                />
                {agent.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - sign in form */}
      <div className="login-form-panel">
        <div className="login-card">
          <div className="login-card-header">
            <div className="login-card-title">Welcome back</div>
            <div className="login-card-subtitle">
              <ShieldCheck className="login-card-icon" />
              Sign in to access the operations center
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="login-form-fields">
              <div className="login-field">
                <label className="login-label" htmlFor="login-email">
                  Email
                </label>
                <div className="login-input-wrap">
                  <input
                    id="login-email"
                    className="login-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    placeholder="demo@sentinelai.com"
                    required
                  />
                  <Mail className="login-input-icon" />
                </div>
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="login-password">
                  Password
                </label>
                <div className="login-input-wrap">
                  <input
                    id="login-password"
                    className="login-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                  />
                  <Lock className="login-input-icon" />
                </div>
              </div>
            </div>

            <div className="login-actions">
              <button
                type="submit"
                disabled={submitting}
                className="login-btn-primary"
              >
                {submitting ? "Signing in..." : "Sign In"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>

              <div className="login-divider">or continue with</div>

              <div className="login-oauth-row">
                <a href="/api/auth/google" className="login-btn-oauth">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.92.45 3.73 1.18 5.07l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </a>
                <a href="/api/auth/microsoft" className="login-btn-oauth">
                  <svg viewBox="0 0 23 23" width="18" height="18">
                    <rect fill="#F25022" x="0" y="0" width="11" height="11"/>
                    <rect fill="#7FBA00" x="12" y="0" width="11" height="11"/>
                    <rect fill="#00A4EF" x="0" y="12" width="11" height="11"/>
                    <rect fill="#FFB900" x="12" y="12" width="11" height="11"/>
                  </svg>
                  Microsoft
                </a>
              </div>

              <div className="login-divider">or</div>

              <button
                type="button"
                onClick={handleDemoMode}
                className="login-btn-demo"
              >
                <Zap className="h-4 w-4" />
                Launch Demo Mode
                <span className="login-btn-demo-badge">1-CLICK</span>
              </button>
            </div>

            {error && <div className="login-error">{error}</div>}
          </form>
        </div>

        <Link to="/" className="login-back-link">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to landing page
        </Link>
      </div>
    </div>
  );
}
