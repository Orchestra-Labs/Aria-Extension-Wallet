import React, { lazy } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';

import { ROUTES } from '@/constants';
import { AuthGuard, GuestGuard } from '@/guards';

const AuthLayout = lazy(() => import('@/layouts/auth/AuthLayout'));
const MainLayout = lazy(() => import('@/layouts/main/MainLayout'));

export const AppRouter: React.FC = (): React.ReactElement | null =>
  useRoutes([
    {
      path: ROUTES.AUTH.ROOT,
      element: (
        <GuestGuard>
          <AuthLayout />
        </GuestGuard>
      ),
      children: [
          {
              path: ROUTES.AUTH.ROOT,
              element: <></>,
          },
      ],
    },
    {
      path: ROUTES.APP.ROOT,
      element: (
        <AuthGuard>
          <MainLayout />
        </AuthGuard>
      ),
      children: [
        {
          path: ROUTES.APP.ROOT,
          element: <></>,
        },
      ],
    },
    { path: '404', element: '' },
    {
      path: '*',
      element: <Navigate to="/404" replace />,
    },
  ]);
