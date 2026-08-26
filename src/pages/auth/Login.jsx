import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, role } = response.data.data;

      login(token, role);

      switch (role) {
        case 'admin':
          navigate('/admin', { replace: true });
          break;
        case 'kamar_hitung':
          navigate('/kamar-hitung', { replace: true });
          break;
        case 'petugas_start':
        case 'petugas_finish':
        case 'petugas_tc':
          navigate('/marshal', { replace: true });
          break;
        default:
          setErrorMsg('Role tidak dikenali oleh sistem.');
          useAuthStore.getState().logout();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Gagal terhubung ke server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Compact<span className="text-red-600">indo</span>
          </h2>
          <p className="mt-2 text-sm text-gray-500">Masuk ke sistem operasional balap</p>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded border border-red-400 bg-red-100 p-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Username</label>
            <input
              type="text"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none transition focus:border-red-500 focus:ring-red-500"
              placeholder="Masukkan username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">Password</label>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full rounded-lg border border-gray-300 p-3 pr-12 outline-none transition focus:border-red-500 focus:ring-red-500"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-gray-500 hover:text-red-600"
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                <PasswordEyeIcon isOpen={showPassword} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-lg bg-red-600 px-4 py-3 font-bold text-white shadow-md transition hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? <span className="animate-pulse">Memverifikasi...</span> : 'MASUK SISTEM'}
          </button>
        </form>
      </div>
    </div>
  );
}

function PasswordEyeIcon({ isOpen }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {!isOpen && <path d="M4 4l16 16" />}
    </svg>
  );
}
