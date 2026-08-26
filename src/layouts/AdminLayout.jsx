import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import AppFooter from '../components/AppFooter';

function Icon({ name, className = 'h-5 w-5', ...props }) {
  const paths = {
    dashboard: (
      <>
        <path d="M4 13.5A8 8 0 0 1 19.5 11" />
        <path d="M12 12l4-4" />
        <path d="M4 19h16" />
      </>
    ),
    master: (
      <>
        <path d="M4 7l8-4 8 4-8 4-8-4Z" />
        <path d="M4 12l8 4 8-4" />
        <path d="M4 17l8 4 8-4" />
      </>
    ),
    map: (
      <>
        <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
        <path d="M9 3v15" />
        <path d="M15 6v15" />
      </>
    ),
    group: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    class: (
      <>
        <path d="M4 5h16" />
        <path d="M4 12h16" />
        <path d="M4 19h16" />
        <path d="M8 5v14" />
      </>
    ),
    category: (
      <>
        <path d="M20.59 13.41 12 22l-9-9V4h9l8.59 8.59a2 2 0 0 1 0 2.82Z" />
        <circle cx="7.5" cy="8.5" r="1.5" />
      </>
    ),
    vehicle: (
      <>
        <path d="M5 17h14l-1.6-6.4A2 2 0 0 0 15.46 9H8.54a2 2 0 0 0-1.94 1.6L5 17Z" />
        <path d="M4 17h16" />
        <circle cx="7.5" cy="17.5" r="2.5" />
        <circle cx="16.5" cy="17.5" r="2.5" />
      </>
    ),
    team: (
      <>
        <path d="M5 21V5" />
        <path d="M5 5h11l-1 4 1 4H5" />
      </>
    ),
    racer: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
      </>
    ),
    event: (
      <>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10v6a5 5 0 0 1-10 0V4Z" />
        <path d="M5 6H3a3 3 0 0 0 3 3h1" />
        <path d="M19 6h2a3 3 0 0 1-3 3h-1" />
      </>
    ),
    flag: (
      <>
        <path d="M4 22V4" />
        <path d="M4 4h12l-1.5 4L16 12H4" />
      </>
    ),
    print: (
      <>
        <path d="M6 9V3h12v6" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v8H6z" />
      </>
    ),
    monitor: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8" />
        <path d="M12 16v4" />
        <path d="M7 11h3l2-3 2 6 2-3h1" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
    chevron: <path d="m6 9 6 6 6-6" />,
  };

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

export default function AdminLayout() {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const [isMasterOpen, setIsMasterOpen] = useState(location.pathname.includes('/admin/master'));
  const [isEventOpen, setIsEventOpen] = useState(location.pathname.includes('/admin/event'));

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const masterSubMenus = [
    { name: 'Wilayah / Region', path: '/admin/master/regions', icon: 'map' },
    { name: 'Kelompok / Group', path: '/admin/master/groups', icon: 'group' },
    { name: 'Kelas / Class', path: '/admin/master/classes', icon: 'class' },
    { name: 'Kategori / Category', path: '/admin/master/categories', icon: 'category' },
    { name: 'Kendaraan / Vehicle', path: '/admin/master/vehicles', icon: 'vehicle' },
    { name: 'Tim / Team', path: '/admin/master/teams', icon: 'team' },
    { name: 'Pembalap / Racer', path: '/admin/master/racers', icon: 'racer' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-150 font-sans">
      <aside className="sticky top-0 h-screen w-64 bg-gray-900 text-white flex flex-col shadow-xl z-20">
        <div className="p-6 text-center border-b border-gray-800">
          <h1 className="text-2xl font-black text-white tracking-wider">COMPACT<span className="text-red-500">INDO</span></h1>
          <p className="text-xs text-gray-400 mt-1 font-medium tracking-wide">Race Time Control</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <Link
            to="/admin"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-semibold ${
              location.pathname === '/admin' ? 'bg-red-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Icon name="dashboard" />
            <span>Dashboard</span>
          </Link>

          <div>
            <button
              onClick={() => setIsMasterOpen(!isMasterOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors font-semibold text-left ${
                location.pathname.includes('/admin/master') ? 'text-white bg-gray-800/50' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon name="master" />
                <span>Master Data</span>
              </span>
              <Icon name="chevron" className="h-4 w-4 transition-transform duration-200" style={{ transform: isMasterOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>

            {isMasterOpen && (
              <div className="mt-1 ml-4 pl-2 border-l border-gray-800 space-y-1">
                {masterSubMenus.map((sub) => {
                  const isSubActive = location.pathname === sub.path;
                  return (
                    <Link
                      key={sub.name}
                      to={sub.path}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                        isSubActive ? 'bg-red-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <Icon name={sub.icon} className="h-4 w-4 shrink-0" />
                      <span>{sub.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <button
              onClick={() => setIsEventOpen(!isEventOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors font-semibold text-left ${
                location.pathname.includes('/admin/event') ? 'text-white bg-gray-800/50' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon name="event" />
                <span>Manajemen Event</span>
              </span>
              <Icon name="chevron" className="h-4 w-4 transition-transform" style={{ transform: isEventOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>

            {isEventOpen && (
              <div className="mt-1 ml-4 pl-2 border-l border-gray-800 space-y-1">
                <Link to="/admin/event/series" className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm ${location.pathname === '/admin/event/series' ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                  <Icon name="trophy" className="h-4 w-4 shrink-0" />
                  <span>Series Kejuaraan</span>
                </Link>
                <Link to="/admin/event/point-systems" className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm ${location.pathname === '/admin/event/point-systems' ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                  <Icon name="trophy" className="h-4 w-4 shrink-0" />
                  <span>Point System</span>
                </Link>
                <Link to="/admin/event" className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm ${location.pathname === '/admin/event' ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                  <Icon name="flag" className="h-4 w-4 shrink-0" />
                  <span>Daftar Event</span>
                </Link>
              </div>
            )}
          </div>

          <Link
            to="/admin/results/print"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-semibold ${
              location.pathname === '/admin/results/print' ? 'bg-red-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Icon name="print" />
            <span>Result</span>
          </Link>
          <Link
            to="/admin/results/shakedown"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-semibold ${
              location.pathname === '/admin/results/shakedown' ? 'bg-red-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Icon name="print" />
            <span>Shakedown Result</span>
          </Link>
          <Link
            to="/admin/results/practice"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-semibold ${
              location.pathname === '/admin/results/practice' ? 'bg-red-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Icon name="trophy" />
            <span>Practice Result</span>
          </Link>
          <a
            href="/monitoring-input"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-semibold ${
              location.pathname === '/monitoring-input' ? 'bg-red-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Icon name="monitor" />
            <span>Monitoring Input</span>
          </a>
          <a
            href="/kamar-hitung"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-semibold ${
              location.pathname === '/kamar-hitung' ? 'bg-red-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Icon name="monitor" />
            <span>Kamar Hitung</span>
          </a>
          <a
            href="/leaderboard"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-semibold ${
              location.pathname === '/leaderboard' ? 'bg-red-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Icon name="trophy" />
            <span>Leaderboard</span>
          </a>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 text-gray-400 rounded-lg hover:bg-red-600 hover:text-white transition-colors font-bold text-sm tracking-wide"
          >
            <Icon name="logout" className="h-4 w-4" />
            <span>LOGOUT</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 flex flex-col pb-12">
        <header className="sticky top-0 bg-white shadow-sm z-10 p-4 flex justify-between items-center border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Panel Operasional</h2>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">A</div>
            <span className="text-sm font-semibold text-gray-700">Admin Pusat</span>
          </div>
        </header>

        <div className="flex-1 bg-gray-50 p-6">
          <Outlet />
        </div>
        <AppFooter admin />
      </main>
    </div>
  );
}
