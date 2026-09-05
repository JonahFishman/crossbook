import { Link, useNavigate } from 'react-router-dom';
import { AuthForm } from '../components/AuthForm';
import { useAuth } from '../lib/useAuth';

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  return (
    <AuthForm
      title="Create an account"
      submitLabel="Register"
      onSubmit={async (email, password) => {
        await signUp(email, password);
        navigate('/');
      }}
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="text-white underline underline-offset-2">
            Sign in
          </Link>
        </>
      }
    />
  );
}
