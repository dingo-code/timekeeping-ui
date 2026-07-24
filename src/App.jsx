import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import Login from './pages/auth/Login';
import AdminLayout from './layouts/AdminLayout';

// Import Halaman CRUD Master
import MasterVehicle from './pages/admin/MasterVehicle';
import MasterRegion from './pages/admin/MasterRegion';
import MasterGroup from './pages/admin/MasterGroup';
import MasterClass from './pages/admin/MasterClass';
import MasterTeam from './pages/admin/MasterTeam';
import MasterRacer from './pages/admin/MasterRacer';
import MasterCategory from './pages/admin/MasterCategory';
import MasterSeries from './pages/admin/MasterSeries';
import MasterEvent from './pages/admin/MasterEvent';
import MasterEventDetail from './pages/admin/MasterEventDetail';
import TimekeepingTerminal from './pages/marshal/TimekeepingTerminal';
import PrintResults from './pages/admin/PrintResults';
import ShakedownReport from './pages/admin/ShakedownReport';
import Timecard from './pages/public/Timecard';
import Leaderboard from './pages/public/Leaderboard';

// ---> TAMBAHKAN IMPORT INI <---
import KamarHitung from './pages/admin/KamarHitung';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { token, role } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/unauthorized" replace />;
  return children;
};

const DummyPage = ({ title }) => (
  <div className="p-8 bg-white rounded-xl shadow-sm text-xl font-bold text-gray-700 border border-gray-100">
    {title}
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<DummyPage title="403 - Akses Ditolak" />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/timecard/:eventId" element={<Timecard />} />
        <Route path="/timecard/:eventId/:participantId" element={<Timecard />} />

        {/* Panel Admin dengan Sub-Rute Baru */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DummyPage title="Selamat Datang di Dashboard Admin" />} />
          
          {/* Sub-menu Master Data */}
          <Route path="master/regions" element={<MasterRegion />} />
          <Route path="master/groups" element={<MasterGroup />} />
          <Route path="master/classes" element={<MasterClass />} />
          <Route path="master/categories" element={<MasterCategory />} />
          <Route path="master/vehicles" element={<MasterVehicle />} />
          <Route path="master/teams" element={<MasterTeam />} />
          <Route path="master/racers" element={<MasterRacer />} />
          <Route path="event/series" element={<MasterSeries />} />
          <Route path="event" element={<MasterEvent />} />
          <Route path="event/:id" element={<MasterEventDetail />} />
          <Route path="results/print" element={<PrintResults />} />
          <Route path="results/shakedown" element={<ShakedownReport />} />
          
          <Route path="event" element={<DummyPage title="Halaman Pengelolaan Event & SS" />} />
          <Route path="penalty" element={<DummyPage title="Halaman Setup Master Penalti" />} />
        </Route>

        <Route path="/marshal" element={
          <ProtectedRoute>
            <TimekeepingTerminal />
          </ProtectedRoute>
        } />

        {/* Role lain tetap menggunakan placeholder untuk sementara */}
        <Route path="/kamar-hitung" element={
          <ProtectedRoute allowedRoles={['kamar_hitung', 'admin']}>
            <KamarHitung />
          </ProtectedRoute>
        } />
        
        {/* Rute Pos Start & Finish yang lama bisa dihapus atau dibiarkan saja sebagai cadangan */}
        <Route path="/pos-start" element={<ProtectedRoute allowedRoles={['petugas_start']}><DummyPage title="Pos Start" /></ProtectedRoute>} />
        <Route path="/pos-finish" element={<ProtectedRoute allowedRoles={['petugas_finish']}><DummyPage title="Pos Finish" /></ProtectedRoute>} />
        <Route path="/pos-tc" element={<ProtectedRoute allowedRoles={['petugas_tc']}><TimekeepingTerminal /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
