import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Worker, MedicationRecipe } from '../types';
import { dataService } from '../lib/dataService';
import { isClinicalDerivationItem } from '../utils/categoryUtils';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface DataContextType {
  workers: Worker[];
  recipes: MedicationRecipe[];
  loading: boolean;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  refreshData: (force?: boolean) => Promise<void>;
  updateWorkerInState: (worker: Worker) => void;
  removeWorkerFromState: (workerId: string) => void;
  addWorkerToState: (worker: Worker) => void;
  updateRecipeInState: (recipe: MedicationRecipe) => void;
  removeRecipeFromState: (recipeId: string) => void;
  addRecipeToState: (recipe: MedicationRecipe) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [recipes, setRecipes] = useState<MedicationRecipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async (force = false) => {
    if (!user) return;
    try {
      if (force) {
        setIsRefreshing(true);
        dataService.invalidateCache();
      } else {
        setLoading(true);
      }

      const [w, r] = await Promise.all([
        dataService.getWorkers(force),
        dataService.getMedicationRecipes(force)
      ]);

      let finalRecipes = r;
      // Opción 2: Escaneo de verificación y movilización masiva a derivación de forma transparente y sin botones
      const candidates = r.filter(item => item.category !== 'medical_derivation' && isClinicalDerivationItem(item));
      if (candidates.length > 0) {
        try {
          const { reclassifiedIds } = await dataService.reclassifyClinicalSuppliesToDerivations(r);
          if (reclassifiedIds.length > 0) {
            finalRecipes = r.map(item => {
              if (reclassifiedIds.includes(item.id)) {
                return {
                  ...item,
                  category: 'medical_derivation',
                  derivationReason: item.derivationReason || item.medication || item.supplyName || 'Estudio / Atención Asistencial',
                  derivationService: item.derivationService || item.supplyName || item.medication || 'Atención Médica / Estudio Clínico',
                };
              }
              return item;
            });
            console.log(`[Reclasificación Opción 2] Se movilizaron con éxito ${reclassifiedIds.length} solicitudes hacia Atenciones y Derivación.`);
          }
        } catch (migErr) {
          console.warn("Aviso en ejecución de Opción 2:", migErr);
        }
      }

      setWorkers(w);
      setRecipes(finalRecipes);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error al sincronizar datos:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData(false);
    } else {
      setWorkers([]);
      setRecipes([]);
      setLoading(false);
    }
  }, [user, loadData]);

  const refreshData = async (force = true) => {
    await loadData(force);
    if (force) {
      toast.success("Datos actualizados desde el servidor");
    }
  };

  const updateWorkerInState = (updated: Worker) => {
    setWorkers(prev => prev.map(w => w.id === updated.id ? { ...w, ...updated } : w));
  };

  const removeWorkerFromState = (workerId: string) => {
    setWorkers(prev => prev.filter(w => w.id !== workerId));
    setRecipes(prev => prev.filter(r => r.workerId !== workerId));
  };

  const addWorkerToState = (newWorker: Worker) => {
    setWorkers(prev => [newWorker, ...prev]);
  };

  const updateRecipeInState = (updatedRecipe: MedicationRecipe) => {
    setRecipes(prev => prev.map(r => r.id === updatedRecipe.id ? { ...r, ...updatedRecipe } : r));
  };

  const removeRecipeFromState = (recipeId: string) => {
    setRecipes(prev => prev.filter(r => r.id !== recipeId));
  };

  const addRecipeToState = (newRecipe: MedicationRecipe) => {
    setRecipes(prev => [newRecipe, ...prev]);
  };

  return (
    <DataContext.Provider
      value={{
        workers,
        recipes,
        loading,
        isRefreshing,
        lastUpdated,
        refreshData,
        updateWorkerInState,
        removeWorkerFromState,
        addWorkerToState,
        updateRecipeInState,
        removeRecipeFromState,
        addRecipeToState,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData debe utilizarse dentro de un DataProvider');
  }
  return context;
};
