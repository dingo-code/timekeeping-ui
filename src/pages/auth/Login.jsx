import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login); // Ambil fungsi login dari Zustand

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      // Tembak endpoint Golang
      const response = await api.post('/auth/login', { username, password });
      
      const { token, role } = response.data.data;

      // 1. Simpan token & role ke Zustand (dan LocalStorage)
      login(token, role);

      // 2. Arahkan pengguna ke halamannya masing-masing (Routing Cerdas)
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
      // Tangkap error dari backend (misal: "username atau password salah")
      setErrorMsg(err.response?.data?.error || 'Gagal terhubung ke server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Cyverra <span className="text-red-600">Studio</span>
          </h2>
          <p className="text-sm text-gray-500 mt-2">Masuk ke sistem operasional balap</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Username</label>
            <input
              type="text"
              required
              className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 outline-none transition"
              placeholder="Masukkan username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">Password</label>
            <input
              type="password"
              required
              className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 outline-none transition"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition disabled:opacity-50 flex justify-center"
          >
            {isLoading ? (
              <span className="animate-pulse">Memverifikasi...</span>
            ) : (
              'MASUK SISTEM'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
