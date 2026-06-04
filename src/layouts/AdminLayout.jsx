import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function AdminLayout() {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  
  // State untuk mengontrol buka/tutup dropdown Master Data
  const [isMasterOpen, setIsMasterOpen] = useState(location.pathname.includes('/admin/master'));
  const [isEventOpen, setIsEventOpen] = useState(location.pathname.includes('/admin/event'));

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const masterSubMenus = [
    { name: '📍 Wilayah / Region', path: '/admin/master/regions' },
    { name: '👥 Kelompok / Group', path: '/admin/master/groups' },
    { name: '🏎️ Kelas / Class', path: '/admin/master/classes' },
    { name: '🏷️ Kategori / Category', path: '/admin/master/categories' },
    { name: '🚘 Kendaraan / Vehicle', path: '/admin/master/vehicles' },
    { name: '🏁 Tim / Team', path: '/admin/master/teams' }, 
    { name: '🪪 Pembalap / Racer', path: '/admin/master/racers' },
  ];

  return (
    <div className="flex h-screen bg-gray-150 font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl z-20">
        <div className="p-6 text-center border-b border-gray-800">
          <h1 className="text-2xl font-black text-red-500 tracking-wider">CYVERRA<span className="text-white">STUDIO</span></h1>
          <p className="text-xs text-gray-400 mt-1 font-medium tracking-wide">Race Time Control</p>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {/* Menu Dashboard */}
          <Link
            to="/admin"
            className={`flex items-center px-4 py-3 rounded-lg transition-colors font-semibold ${
              location.pathname === '/admin' ? 'bg-red-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            📊 Dashboard
          </Link>

          {/* Menu Dropdown Master Data */}
          <div>
            <button
              onClick={() => setIsMasterOpen(!isMasterOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors font-semibold text-left ${
                location.pathname.includes('/admin/master') ? 'text-white bg-gray-800/50' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center">📦 Master Data</span>
              <span className="text-xs transition-transform duration-200" style={{ transform: isMasterOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>
            
            {/* Sub-menu container */}
            {isMasterOpen && (
              <div className="mt-1 ml-4 pl-2 border-l border-gray-800 space-y-1">
                {masterSubMenus.map((sub) => {
                  const isSubActive = location.pathname === sub.path;
                  return (
                    <Link
                      key={sub.name}
                      to={sub.path}
                      className={`block px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                        isSubActive ? 'bg-red-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      {sub.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Menu Kelola Event */}
          <div>
            <button
              onClick={() => setIsEventOpen(!isEventOpen)} // Buat state [isEventOpen, setIsEventOpen] di atas
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors font-semibold text-left ${
                location.pathname.includes('/admin/event') ? 'text-white bg-gray-800/50' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center">📅 Manajemen Event</span>
              <span className="text-xs transition-transform" style={{ transform: isEventOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>
            
            {isEventOpen && (
              <div className="mt-1 ml-4 pl-2 border-l border-gray-800 space-y-1">
                <Link to="/admin/event/series" className={`block px-4 py-2 rounded-md text-sm ${location.pathname === '/admin/event/series' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  🏆 Series Kejuaraan
                </Link>
                <Link to="/admin/event" className={`block px-4 py-2 rounded-md text-sm ${location.pathname === '/admin/event' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  🏁 Daftar Event
                </Link>
              </div>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={handleLogout}
            className="w-full px-4 py-2.5 bg-gray-800 text-gray-400 rounded-lg hover:bg-red-600 hover:text-white transition-colors font-bold text-sm tracking-wide"
          >
            LOGOUT
          </button>
        </div>
      </aside>

      {/* AREA UTAMA */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm z-10 p-4 flex justify-between items-center border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Panel Operasional</h2>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">A</div>
            <span className="text-sm font-semibold text-gray-700">Admin Pusat</span>
          </div>
        </header>

        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          <Outlet />
        </div>
      </main>

    </div>
  );
}