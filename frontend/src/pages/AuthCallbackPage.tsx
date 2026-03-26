import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { clearSessionToken, setSessionToken } from "@/components/auth/authToken";

/**
 * Handles the OAuth redirect from the backend.
 * URL: /auth/callback?token=<jwt>
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      clearSessionToken();
      setSessionToken(token);
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login?error=oauth_failed", { replace: true });
    }
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ animation: "spin 1s linear infinite", width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%" }} />
    </div>
  );
}
