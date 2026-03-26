import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import {
  clearSessionToken,
  createMockToken,
  getValidSession,
  setSessionToken,
} from "@/components/auth/authToken";
import { Button } from "@/components/ui/button";

import "./LoginPage.css";

const DEMO_EMAIL = "demo@sentinelai.com";
const DEMO_PASSWORD = "demo1234";

function LogoMark() {
  return (
    <Link to="/" className="login-logo-wrap" style={{ textDecoration: "none" }}>
      <div className="login-wordmark">
        <span className="login-wordmark-primary">Sentinel</span>
        <span className="login-wordmark-accent">AI</span>
      </div>
      <div className="login-subtitle">
        <span className="login-brand">Cirrus<span className="login-brand-accent">Labs</span></span>
      </div>
      <div className="login-tagline">Autonomous Contact Center Intelligence</div>
    </Link>
  );
}

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
      <div className="login-animated-bg" aria-hidden="true" />

      <div className="login-shell">
        <LogoMark />

        <div className="login-card">
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-form-head">
              <div className="login-form-title">Sign in to SentinelAI</div>
              <div className="login-form-subtitle">
                <ShieldCheck className="login-form-icon" />
                Demo mode is pre-wired for a frictionless walkthrough.
              </div>
            </div>

            <div className="login-form-fields">
              <label className="login-label">
                Email
                <input
                  className="login-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>

              <label className="login-label">
                Password
                <input
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>

            </div>

            <div className="login-actions">
              <Button
                type="button"
                variant="outline"
                onClick={handleDemoMode}
                className="border-[#e2e8f0] bg-[#f8fafc] text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1e293b]"
              >
                Demo Mode (1-click)
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#2563eb] text-white shadow-md hover:bg-[#1d4ed8]">
                {submitting ? "Signing in..." : "Login"}
              </Button>
            </div>

            {error && <div className="login-error">{error}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}
