import React from 'react';
import { Helmet } from 'react-helmet';
import { LogOut } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AdminLogin from '@/components/admin/AdminLogin';
import VenuesTab from '@/components/admin/VenuesTab';
import EventsTab from '@/components/admin/EventsTab';
import ReservationsTab from '@/components/admin/ReservationsTab';
import DoorSalesTab from '@/components/admin/DoorSalesTab';
import QrScannerTab from '@/components/admin/QrScannerTab';
import LiveEntryBoard from '@/components/admin/LiveEntryBoard';
import SiteSettingsTab from '@/components/admin/SiteSettingsTab';
import DangerZoneTab from '@/components/admin/DangerZoneTab';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminAuth } from '@/hooks/useAdminAuth';

const AdminDashboard = () => {
  const { isLoading, isAuthenticated, signOut } = useAdminAuth();

  if (isLoading) return null;

  return (
    <>
      <Helmet>
        <title>Admin — Butaca</title>
      </Helmet>
      <Navbar />

      {!isAuthenticated ? (
        <AdminLogin />
      ) : (
        <div className="container py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl">Panel de administración</h1>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
            </Button>
          </div>

          <Tabs defaultValue="venues">
            <TabsList className="mb-6 flex-wrap h-auto">
              <TabsTrigger value="venues">Salas</TabsTrigger>
              <TabsTrigger value="events">Eventos</TabsTrigger>
              <TabsTrigger value="reservations">Reservas</TabsTrigger>
              <TabsTrigger value="door-sales">Venta en puerta</TabsTrigger>
              <TabsTrigger value="qr-scanner">Lector QR</TabsTrigger>
              <TabsTrigger value="live-board">Pantalla en vivo</TabsTrigger>
              <TabsTrigger value="site-settings">Personalizar sitio</TabsTrigger>
              <TabsTrigger value="danger" className="text-destructive">Peligro</TabsTrigger>
            </TabsList>
            <TabsContent value="venues">
              <VenuesTab />
            </TabsContent>
            <TabsContent value="events">
              <EventsTab />
            </TabsContent>
            <TabsContent value="reservations">
              <ReservationsTab />
            </TabsContent>
            <TabsContent value="door-sales">
              <DoorSalesTab />
            </TabsContent>
            <TabsContent value="qr-scanner">
              <QrScannerTab />
            </TabsContent>
            <TabsContent value="live-board">
              <LiveEntryBoard />
            </TabsContent>
            <TabsContent value="site-settings">
              <SiteSettingsTab />
            </TabsContent>
            <TabsContent value="danger">
              <DangerZoneTab />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </>
  );
};

export default AdminDashboard;
