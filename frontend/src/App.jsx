import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import InfluencerDashboard from './pages/InfluencerDashboard';
import RapMediaDashboard from './pages/RapMediaDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import LinkList from './pages/LinkList';
import Projects from './pages/Projects';
import CampaignReport from './pages/CampaignReport';
import AdminUsers from './pages/AdminUsers';
import Payments from './pages/Payments';
import PaymentRules from './pages/PaymentRules';
import Reports from './pages/Reports';
import Songs from './pages/Songs';
import Videos from './pages/Videos';
import VideoReports from './pages/VideoReports';
import VideoReportDetail from './pages/VideoReportDetail';
import RoleProjects from './pages/RoleProjects';
import Profile from './pages/Profile';
import MyVideos from './pages/MyVideos';
import MediaLinks from './pages/MediaLinks';
import Home from './pages/Home';
import Contact from './pages/Contact';
import Register from './pages/Register';
import AdminMembers from './pages/AdminMembers';
import AdminContactMessages from './pages/AdminContactMessages';
import OfferDetail from './pages/OfferDetail';
import PublicOffer from './pages/PublicOffer';
import NotFound from './pages/NotFound';

function useHashScroll(location) {
  useEffect(() => {
    if (!location.hash) return undefined;
    const id = location.hash.slice(1);
    let raf2;
    // İki rAF: sayfa geçişi sonrası hedef eleman gerçekten boyanana kadar bekle
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [location.pathname, location.hash]);
}

function AppRoutes() {
  const location = useLocation();
  useHashScroll(location);
  return (
    <div key={location.pathname} className="page-transition">
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/iletisim" element={<Contact />} />
        <Route path="/teklif/:token" element={<PublicOffer />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/links"
          element={
            <ProtectedRoute role="admin">
              <LinkList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/projects"
          element={
            <ProtectedRoute role="admin">
              <Projects />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/projects/:id/report" element={<ProtectedRoute role="admin"><CampaignReport /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute role="admin"><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/rap-media" element={<ProtectedRoute role="admin"><AdminMembers kind="rap-media" title="Rap Medyaları" /></ProtectedRoute>} />
        <Route path="/admin/influencers" element={<ProtectedRoute role="admin"><AdminMembers kind="influencers" title="Influencerlar" /></ProtectedRoute>} />
        <Route path="/admin/payments" element={<ProtectedRoute role="admin" fullAdminOnly><Payments /></ProtectedRoute>} />
        <Route path="/admin/payment-rules" element={<ProtectedRoute role="admin" fullAdminOnly><PaymentRules /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute role="admin"><Reports /></ProtectedRoute>} />
        <Route path="/admin/songs" element={<ProtectedRoute role="admin" fullAdminOnly><Songs /></ProtectedRoute>} />
        <Route path="/admin/videos" element={<ProtectedRoute role="admin"><Videos /></ProtectedRoute>} />
        <Route path="/admin/video-reports" element={<ProtectedRoute role="admin"><VideoReports /></ProtectedRoute>} />
        <Route path="/admin/video-reports/:ownerId" element={<ProtectedRoute role="admin"><VideoReportDetail /></ProtectedRoute>} />
        <Route path="/admin/profile" element={<ProtectedRoute role="admin"><Profile /></ProtectedRoute>} />
        <Route path="/admin/contact-messages" element={<ProtectedRoute role="admin" fullAdminOnly><AdminContactMessages /></ProtectedRoute>} />
        <Route path="/admin/offers/:id" element={<ProtectedRoute role="admin" fullAdminOnly><OfferDetail /></ProtectedRoute>} />
        <Route
          path="/influencer"
          element={
            <ProtectedRoute role="influencer">
              <InfluencerDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/influencer/projects" element={<ProtectedRoute role="influencer"><RoleProjects /></ProtectedRoute>} />
        <Route path="/influencer/videos" element={<ProtectedRoute role="influencer"><MyVideos /></ProtectedRoute>} />
        <Route path="/influencer/profile" element={<ProtectedRoute role="influencer"><Profile /></ProtectedRoute>} />
        <Route
          path="/rapmedia"
          element={
            <ProtectedRoute role="rapmedia">
              <RapMediaDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rap-media"
          element={
            <ProtectedRoute role="rapmedia">
              <RapMediaDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/rap-media/projects" element={<ProtectedRoute role="rapmedia"><RoleProjects title="Atanan Projeler" /></ProtectedRoute>} />
        <Route path="/rap-media/links" element={<ProtectedRoute role="rapmedia"><MediaLinks /></ProtectedRoute>} />
        <Route path="/rap-media/profile" element={<ProtectedRoute role="rapmedia"><Profile /></ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
