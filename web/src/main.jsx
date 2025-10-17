import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import SignIn from './components/SignIn.jsx';
// Removed NotFound component usage so hosting can serve static 404.html

// Route changes:
//  - Root path now 301/302 client-side redirected to /round-generator for canonical SEO-friendly URL
//  - /round-generator hosts the existing Round Generator experience
//  - /signin unchanged
const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/round-generator" replace /> },
  { path: '/round-generator', element: <App /> },
  { path: '/practice', element: <App /> },
  { path: '/signin', element: <SignIn /> },
]);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <RouterProvider router={router} />
    </HelmetProvider>
  </React.StrictMode>
);
