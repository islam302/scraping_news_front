import { createContext, useContext, useEffect, useState } from 'react';
import { onApiMaintenance } from '../services/api';

const MaintenanceContext = createContext(null);

export function MaintenanceProvider({ children }) {
  const [down, setDown] = useState(false);

  // Listen to the axios interceptor: it flips this on backend/proxy outages
  // and clears it again as soon as any request succeeds.
  useEffect(() => onApiMaintenance(setDown), []);

  return (
    <MaintenanceContext.Provider value={{ down, setDown }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export const useMaintenance = () => useContext(MaintenanceContext);
