import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm transition-colors ${
    isActive ? 'bg-edge text-white' : 'text-muted hover:text-white'
  }`;

export function Nav() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-edge">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
        <NavLink to="/" className="mr-auto text-base font-semibold tracking-tight text-white">
          Crossbook
        </NavLink>
        <NavLink to="/" className={link} end>
          Board
        </NavLink>
        {user && (
          <NavLink to="/watchlist" className={link}>
            Watchlist
          </NavLink>
        )}
        {user ? (
          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
            className="rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:text-white"
          >
            Sign out
          </button>
        ) : (
          <>
            <NavLink to="/login" className={link}>
              Sign in
            </NavLink>
            <NavLink
              to="/register"
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
            >
              Register
            </NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
