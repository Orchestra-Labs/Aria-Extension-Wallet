import React, { lazy } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';

import { ROUTES } from '@/constants';
import { AuthGuard, GuestGuard } from '@/guards';
import { ExpandedLayout } from '@/layouts';
import {
  AddNewNetwork,
  ChangePassword,
  CreateWallet,
  EditCoinListScreen,
  ImportWallet,
  Login,
  Main,
  MediaOnboardingScreen,
  NewWallet,
  Send,
  SettingsScreen,
  SwapTutorial,
  Transaction,
  TransactionsHistory,
  ViewPassphrase,
} from '@/pages';

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
          element: <Login />,
        },
        {
          path: ROUTES.AUTH.NEW_WALLET.ROOT,
          element: <NewWallet />,
        },
        {
          path: ROUTES.AUTH.NEW_WALLET.CREATE,
          element: <CreateWallet />,
        },
        {
          path: ROUTES.AUTH.NEW_WALLET.IMPORT,
          element: <ImportWallet />,
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
          element: <Main />,
        },
        {
          path: ROUTES.APP.TRANSACTIONS_HISTORY,
          element: <TransactionsHistory />,
        },
        {
          path: ROUTES.APP.TRANSACTION,
          element: <Transaction />,
        },
        {
          path: ROUTES.APP.SEND,
          element: <Send />,
        },
        {
          path: ROUTES.APP.ADD_NETWORK,
          element: <AddNewNetwork />,
        },
        {
          path: ROUTES.APP.EDIT_COIN_LIST,
          element: <EditCoinListScreen />,
        },
        {
          path: ROUTES.APP.SETTINGS,
          element: <SettingsScreen />,
        },
        {
          path: ROUTES.APP.VIEW_PASSPHRASE,
          element: <ViewPassphrase />,
        },
        {
          path: ROUTES.APP.CHANGE_PASSWORD,
          element: <ChangePassword />,
        },
        {
          path: ROUTES.APP.VIEW_TUTORIAL,
          element: <SwapTutorial />,
        },
      ],
    },
    {
      path: ROUTES.APP.ROOT,
      element: <ExpandedLayout />,
      children: [
        {
          path: ROUTES.APP.MEDIA_ONBOARDING,
          element: <MediaOnboardingScreen />,
        },
      ],
    },
    { path: '404', element: '' },
    {
      path: '*',
      element: <Navigate to="/404" replace />,
    },
  ]);
