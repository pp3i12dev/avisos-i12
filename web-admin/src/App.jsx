import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import AppRouter from './routes/AppRoutes';
import InstitutionFooter from './components/InstitutionFooter';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
        <InstitutionFooter />
      </AuthProvider>
    </QueryClientProvider>
  );
}