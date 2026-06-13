import React, { useState } from "react";
import { api } from "./api";

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let data;
      if (isLogin) {
        data = await api.login(username, password);
      } else {
        data = await api.register(username, password);
      }
      localStorage.setItem("auth_token", data.token);
      onAuthSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal panel">
        <h2>{isLogin ? "Logowanie" : "Rejestracja"}</h2>
        {error && <div className="alert" style={{ marginBottom: "1rem" }}>{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            <span className="field-label">Nazwa użytkownika</span>
            <input
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Hasło</span>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Wysyłanie..." : (isLogin ? "Zaloguj się" : "Zarejestruj się")}
          </button>
        </form>
        <p className="auth-switch" style={{ marginTop: "1rem", textAlign: "center" }}>
          {isLogin ? "Nie masz konta? " : "Masz już konto? "}
          <button type="button" className="link-btn" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Zarejestruj się" : "Zaloguj się"}
          </button>
        </p>
      </div>
    </div>
  );
}
