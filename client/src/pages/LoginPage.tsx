import { Link, useNavigate } from 'react-router-dom';
import { AuthForm } from '../components/AuthForm';
import { useAuth } from '../lib/useAuth';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  return (
    <AuthForm
      title="Sign in"
      submitLabel="Sign in"
      onSubmit={async (email, password) => {
        await signIn(email, password);
        navigate('/');
      }}
      footer={
        <>
          No account?{' '}
          <Link to="/register" className="text-white underline underline-offset-2">
            Register
          </Link>
        </>
      }
    />
  );
}
