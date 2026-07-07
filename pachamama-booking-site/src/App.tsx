import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import FormBookingPage from '@/pages/FormBookingPage';
import RetreatsGridPage from '@/pages/RetreatsGridPage';
import RetreatBookingPage from '@/pages/RetreatBookingPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/retreats" element={<RetreatsGridPage />} />
        <Route path="/retreats/:slug" element={<RetreatBookingPage />} />
        <Route path="/:slug" element={<FormBookingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
