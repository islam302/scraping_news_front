import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LangProvider } from '../context/LangContext';
import { ThemeProvider } from '../context/ThemeContext';
import { MaintenanceProvider } from '../context/MaintenanceContext';

/**
 * Render inside the real Theme/Lang/Maintenance providers and a MemoryRouter.
 * `path` is the route pattern the element is mounted on (e.g. '/tasks/:missionId').
 */
export function renderWithProviders(ui, { route = '/', path, lang = 'en', extraRoutes = null } = {}) {
  localStorage.setItem('lang', lang);
  return render(
    <ThemeProvider>
      <LangProvider>
        <MaintenanceProvider>
          <MemoryRouter initialEntries={[route]}>
            {path ? (
              <Routes>
                <Route path={path} element={ui} />
                {extraRoutes}
              </Routes>
            ) : ui}
          </MemoryRouter>
        </MaintenanceProvider>
      </LangProvider>
    </ThemeProvider>,
  );
}
