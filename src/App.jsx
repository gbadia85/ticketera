import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import GlowBackdrop from '@/components/GlowBackdrop';
import HomePage from '@/pages/HomePage';
import EventDetailsPage from '@/pages/EventDetailsPage';
import CheckoutPage from '@/pages/CheckoutPage';
import PaymentResultPage from '@/pages/PaymentResultPage';
import AdminDashboard from '@/pages/AdminDashboard';
import VenuesPage from '@/pages/VenuesPage';
import VenueDetailsPage from '@/pages/VenueDetailsPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <GlowBackdrop />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/evento/:eventId" element={<EventDetailsPage />} />
          <Route path="/checkout/:eventId" element={<CheckoutPage />} />
          <Route path="/pago/resultado" element={<PaymentResultPage />} />
          <Route path="/salas" element={<VenuesPage />} />
          <Route path="/salas/:venueId" element={<VenueDetailsPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </div>
    </Router>
  );
}

export default App;
