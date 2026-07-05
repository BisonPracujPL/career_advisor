import { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';

export const MODES = [
  { id: "search", label: "Szukaj pracy", icon: "◆" },
  { id: "path", label: "Ścieżka kariery", icon: "◎" },
  { id: "chat", label: "Doradca AI", icon: "💬" },
];

export interface NavbarProps {
  mode: string;
  setMode: (mode: string) => void;
  isLoggedIn: boolean;
  setShowAuth: (show: boolean) => void;
  handleLogout: () => void;
  onProfileClick: () => void;
  hasProfile: boolean;
  profileData: UserProfile | null;
}

export function Navbar({ mode, setMode, isLoggedIn, setShowAuth, handleLogout, onProfileClick }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <nav className="global-nav">
      <div className="global-nav-content">
        <div className="global-nav-left">
          <a href="#" className="global-nav-brand" onClick={(e) => { e.preventDefault(); setMode("search"); }}>
            career advisor
          </a>
          <div className="global-nav-links">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`global-nav-link ${mode === m.id ? "active" : ""}`}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="global-nav-right">
          {!isLoggedIn ? (
            <button type="button" className="nav-user-btn" onClick={() => setShowAuth(true)}>
              <span className="nav-user-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </span>
              Zaloguj się
            </button>
          ) : (
            <div className="nav-user-dropdown" ref={menuRef}>
              <button type="button" className="nav-user-btn" onClick={() => setMenuOpen(!menuOpen)}>
                <span className="nav-user-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </span>
                Moje konto <span style={{fontSize: '0.8em', marginLeft: '0.2rem'}}>{menuOpen ? '▲' : '▼'}</span>
              </button>
              
              {menuOpen && (
                <div className="nav-dropdown-menu">
                  <button type="button" className="nav-dropdown-item" onClick={() => { setMenuOpen(false); onProfileClick(); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Mój profil
                  </button>
                  <hr style={{ margin: "0.25rem 0", border: "none", borderTop: "1px solid var(--border)" }} />
                  <button type="button" className="nav-dropdown-item" onClick={() => { setMenuOpen(false); handleLogout(); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Wyloguj się
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
