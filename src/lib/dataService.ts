import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  Timestamp,
  collectionGroup,
  limit
} from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from './firebase';
import { Worker, MedicalHistory, Evaluation, MedicationRecipe, UserProfile, UserRole } from '../types';
import { normalizeDni } from '../utils/securityDni';
import { isClinicalDerivationItem } from '../utils/categoryUtils';

const WORKERS_COLLECTION = 'workers';
const EVALUATIONS_COLLECTION = 'evaluations';
const MEDICATIONS_COLLECTION = 'medication_recipes';
const USERS_COLLECTION = 'users';

// In-memory caching layer to prevent redundant reads across route changes
let cachedWorkers: Worker[] | null = null;
let workersCacheTimestamp = 0;
let cachedRecipes: MedicationRecipe[] | null = null;
let recipesCacheTimestamp = 0;
let cachedHistories: MedicalHistory[] | null = null;
let historiesCacheTimestamp = 0;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de vigencia en memoria local

export const dataService = {
  // User Profiles
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, USERS_COLLECTION, uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as UserProfile;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${USERS_COLLECTION}/${uid}`);
      return null;
    }
  },

  async createUserProfile(profile: UserProfile): Promise<void> {
    try {
      await setDoc(doc(db, USERS_COLLECTION, profile.uid), {
        ...profile,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${USERS_COLLECTION}/${profile.uid}`);
    }
  },

  async getAllUsers(): Promise<UserProfile[]> {
    try {
      const snapshot = await getDocs(collection(db, USERS_COLLECTION));
      const usersList = snapshot.docs.map(doc => doc.data() as UserProfile);
      return usersList.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
      return [];
    }
  },

  async updateUserRole(uid: string, role: UserRole): Promise<void> {
    try {
      await updateDoc(doc(db, USERS_COLLECTION, uid), {
        role,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COLLECTION}/${uid}`);
    }
  },

  async updateUserBlockedStatus(uid: string, blocked: boolean): Promise<void> {
    try {
      await updateDoc(doc(db, USERS_COLLECTION, uid), {
        blocked,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COLLECTION}/${uid}`);
      throw error;
    }
  },

  async deleteUserProfile(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(db, USERS_COLLECTION, uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${USERS_COLLECTION}/${uid}`);
      throw error;
    }
  },

  // Cache invalidation helpers
  invalidateCache() {
    cachedWorkers = null;
    workersCacheTimestamp = 0;
    cachedRecipes = null;
    recipesCacheTimestamp = 0;
    cachedHistories = null;
    historiesCacheTimestamp = 0;
  },

  invalidateWorkersCache() {
    cachedWorkers = null;
    workersCacheTimestamp = 0;
  },

  invalidateRecipesCache() {
    cachedRecipes = null;
    recipesCacheTimestamp = 0;
  },

  // Workers
  async getWorkers(forceRefresh = false): Promise<Worker[]> {
    if (!forceRefresh && cachedWorkers && (Date.now() - workersCacheTimestamp < CACHE_TTL_MS)) {
      return cachedWorkers;
    }
    try {
      const q = query(collection(db, WORKERS_COLLECTION), orderBy('fullName'));
      const snapshot = await getDocs(q);
      const workers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Worker));
      cachedWorkers = workers;
      workersCacheTimestamp = Date.now();
      return workers;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, WORKERS_COLLECTION);
      return cachedWorkers || [];
    }
  },

  async findWorkerByDni(dni: string): Promise<Worker | null> {
    if (!dni || dni.trim().length < 4) return null;
    const cleanDni = dni.trim();
    const normalizedDni = normalizeDni(cleanDni);
    const numericOnly = cleanDni.replace(/\D/g, '');

    // 1. Verificación instantánea en memoria si el caché de trabajadores está cargado (0 lecturas)
    if (cachedWorkers && cachedWorkers.length > 0) {
      const foundInCache = cachedWorkers.find(w => {
        const wDni = (w.dni || '').trim();
        if (wDni.toLowerCase() === cleanDni.toLowerCase() || (normalizedDni && wDni.toLowerCase() === normalizedDni.toLowerCase())) {
          return true;
        }
        if (numericOnly.length >= 5 && wDni.replace(/\D/g, '') === numericOnly) {
          return true;
        }
        return false;
      });
      if (foundInCache) return foundInCache;
    }

    try {
      // 2. Construir lista compacta de variantes candidatas para UNA SOLA consulta 'in' (1 lectura)
      const candidateSet = new Set<string>();
      candidateSet.add(cleanDni);
      if (normalizedDni) candidateSet.add(normalizedDni);
      
      if (numericOnly.length >= 5) {
        candidateSet.add(numericOnly);
        candidateSet.add(`V-${numericOnly}`);
        candidateSet.add(`V${numericOnly}`);
        candidateSet.add(`E-${numericOnly}`);
        candidateSet.add(`E${numericOnly}`);
        const withDots = numericOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        if (withDots) {
          candidateSet.add(withDots);
          candidateSet.add(`V-${withDots}`);
          candidateSet.add(`V.${withDots}`);
          candidateSet.add(`E-${withDots}`);
          candidateSet.add(`E.${withDots}`);
        }
      }

      const candidateList = Array.from(candidateSet).filter(Boolean).slice(0, 30);
      const q = query(
        collection(db, WORKERS_COLLECTION),
        where('dni', 'in', candidateList),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as Worker;
      }
      return null;
    } catch (error) {
      console.error("Error buscando ciudadano por cédula:", error);
      return null;
    }
  },

  async addWorker(
    workerData: Omit<Worker, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
    options?: { allowReturnExisting?: boolean }
  ): Promise<string> {
    try {
      // 1. Normalización estándar de cédula
      const cleanDni = normalizeDni(workerData.dni) || workerData.dni.trim().toUpperCase();

      // 2. Verificación estricta de unicidad en base de datos
      const existing = await this.findWorkerByDni(workerData.dni);
      if (existing) {
        if (options?.allowReturnExisting) {
          return existing.id;
        }
        throw new Error(`DUPLICATE_DNI: El ciudadano con C.I. ${cleanDni} ya se encuentra registrado en el sistema con el nombre "${existing.fullName}".`);
      }

      // 3. Inserción con DNI normalizado
      const workerId = doc(collection(db, WORKERS_COLLECTION)).id;
      const workerDoc = {
        ...workerData,
        dni: cleanDni,
        createdBy: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, WORKERS_COLLECTION, workerId), workerDoc);
      if (cachedWorkers) {
        cachedWorkers = [{ id: workerId, ...workerDoc, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as Worker, ...cachedWorkers];
      }
      return workerId;
    } catch (error: any) {
      if (error?.message?.startsWith('DUPLICATE_DNI')) {
        throw error;
      }
      handleFirestoreError(error, OperationType.CREATE, WORKERS_COLLECTION);
      return '';
    }
  },

  /**
   * Unifica dos expedientes duplicados:
   * Reasigna todas las recetas/ayudas médicas del duplicado al expediente principal
   * y luego elimina el registro duplicado de forma segura.
   */
  async mergeWorkers(primaryWorkerId: string, duplicateWorkerId: string): Promise<void> {
    if (!primaryWorkerId || !duplicateWorkerId || primaryWorkerId === duplicateWorkerId) {
      throw new Error("Identificadores inválidos para la fusión de expedientes.");
    }
    try {
      // 1. Migrar recetas/medicamentos del duplicado al principal
      const q = query(collection(db, MEDICATIONS_COLLECTION), where('workerId', '==', duplicateWorkerId));
      const recipesSnapshot = await getDocs(q);
      for (const recipeDoc of recipesSnapshot.docs) {
        await updateDoc(doc(db, MEDICATIONS_COLLECTION, recipeDoc.id), {
          workerId: primaryWorkerId,
          mergedFrom: duplicateWorkerId,
          mergedAt: serverTimestamp(),
        });
      }

      // 2. Eliminar el expediente duplicado
      await deleteDoc(doc(db, WORKERS_COLLECTION, duplicateWorkerId));

      // Invalidar cachés locales para reflejar la unificación
      cachedWorkers = null;
      cachedRecipes = null;
    } catch (error) {
      console.error("Error al fusionar expedientes duplicados:", error);
      throw error;
    }
  },

  async updateWorker(workerId: string, workerData: Partial<Worker>): Promise<void> {
    try {
      const docRef = doc(db, WORKERS_COLLECTION, workerId);
      await updateDoc(docRef, {
        ...workerData,
        updatedAt: serverTimestamp(),
      });
      if (cachedWorkers) {
        cachedWorkers = cachedWorkers.map(w => w.id === workerId ? { ...w, ...workerData } : w);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${WORKERS_COLLECTION}/${workerId}`);
    }
  },

  async deleteWorker(workerId: string): Promise<void> {
    try {
      // 1. Delete medical history baseline
      const historyRef = doc(db, `${WORKERS_COLLECTION}/${workerId}/medical_history/baseline`);
      try { await deleteDoc(historyRef); } catch(e){}
      
      // 2. Delete all physical evaluations
      const evalsCol = collection(db, `${WORKERS_COLLECTION}/${workerId}/evaluations`);
      const evalsSnapshot = await getDocs(evalsCol);
      for (const evalDoc of evalsSnapshot.docs) {
        try { await deleteDoc(doc(db, `${WORKERS_COLLECTION}/${workerId}/evaluations/${evalDoc.id}`)); } catch(e){}
      }

      // 3. Delete only associated recipes using targeted query (Evita leer toda la base de datos)
      const medsQuery = query(collection(db, MEDICATIONS_COLLECTION), where('workerId', '==', workerId));
      const medsSnapshot = await getDocs(medsQuery);
      for (const medDoc of medsSnapshot.docs) {
        try { await deleteDoc(doc(db, MEDICATIONS_COLLECTION, medDoc.id)); } catch(e){}
      }

      // 4. Delete the worker document itself
      const docRef = doc(db, WORKERS_COLLECTION, workerId);
      await deleteDoc(docRef);

      // Actualizar memoria local
      if (cachedWorkers) {
        cachedWorkers = cachedWorkers.filter(w => w.id !== workerId);
      }
      if (cachedRecipes) {
        cachedRecipes = cachedRecipes.filter(r => r.workerId !== workerId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${WORKERS_COLLECTION}/${workerId}`);
      throw error;
    }
  },

  // Medical History
  async getMedicalHistory(workerId: string): Promise<MedicalHistory | null> {
    const path = `${WORKERS_COLLECTION}/${workerId}/medical_history/baseline`;
    try {
      const docRef = doc(db, path);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as MedicalHistory;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  // Obtiene todas las historias médicas con 1 sola consulta collectionGroup sin N+1 bucles
  async getAllMedicalHistories(forceRefresh = false): Promise<MedicalHistory[]> {
    if (!forceRefresh && cachedHistories && (Date.now() - historiesCacheTimestamp < CACHE_TTL_MS)) {
      return cachedHistories;
    }
    try {
      const q = query(collectionGroup(db, 'medical_history'));
      const snapshot = await getDocs(q);
      const histories = snapshot.docs.map(d => {
        const data = d.data() as MedicalHistory;
        const workerId = data.workerId || d.ref.parent.parent?.id || '';
        return { ...data, workerId };
      });
      cachedHistories = histories;
      historiesCacheTimestamp = Date.now();
      return histories;
    } catch (error) {
      console.error("Error cargando collectionGroup medical_history:", error);
      return cachedHistories || [];
    }
  },

  async saveMedicalHistory(workerId: string, history: Omit<MedicalHistory, 'updatedAt'>): Promise<void> {
    const path = `${WORKERS_COLLECTION}/${workerId}/medical_history/baseline`;
    try {
      // Clean undefined properties recursively or at first level to avoid Firestore errors
      const cleanHistory: Record<string, any> = {};
      Object.entries(history).forEach(([key, val]) => {
        if (val !== undefined) {
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            const cleanSubObj: Record<string, any> = {};
            Object.entries(val).forEach(([subKey, subVal]) => {
              if (subVal !== undefined) {
                cleanSubObj[subKey] = subVal;
              }
            });
            cleanHistory[key] = cleanSubObj;
          } else {
            cleanHistory[key] = val;
          }
        }
      });

      await setDoc(doc(db, path), {
        ...cleanHistory,
        workerId,
        updatedAt: serverTimestamp(),
      });
      cachedHistories = null;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Evaluations
  async getEvaluations(workerId: string): Promise<Evaluation[]> {
    const path = `${WORKERS_COLLECTION}/${workerId}/evaluations`;
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evaluation));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  // Obtiene todas las evaluaciones de salud con 1 sola consulta collectionGroup sin N+1 bucles
  async getAllEvaluations(limitCount = 150): Promise<Evaluation[]> {
    try {
      const q = query(collectionGroup(db, 'evaluations'), limit(limitCount));
      const snapshot = await getDocs(q);
      const evals = snapshot.docs.map(d => {
        const data = d.data() as Evaluation;
        const workerId = data.workerId || d.ref.parent.parent?.id || '';
        return { id: d.id, ...data, workerId };
      });
      return evals.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    } catch (error) {
      console.error("Error cargando collectionGroup evaluations:", error);
      return [];
    }
  },

  async addEvaluation(workerId: string, evalData: Omit<Evaluation, 'id' | 'evaluatorId' | 'createdAt' | 'workerId'>): Promise<string> {
    const path = `${WORKERS_COLLECTION}/${workerId}/evaluations`;
    try {
      // Clean undefined properties recursively or at first level to avoid Firestore errors
      const cleanEvalData: Record<string, any> = {};
      Object.entries(evalData).forEach(([key, val]) => {
        if (val !== undefined) {
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            const cleanSubObj: Record<string, any> = {};
            Object.entries(val).forEach(([subKey, subVal]) => {
              if (subVal !== undefined) {
                cleanSubObj[subKey] = subVal;
              }
            });
            cleanEvalData[key] = cleanSubObj;
          } else {
            cleanEvalData[key] = val;
          }
        }
      });

      const docRef = await addDoc(collection(db, path), {
        ...cleanEvalData,
        workerId,
        evaluatorId: auth.currentUser?.uid || 'anonymous',
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return '';
    }
  },

  // Medication Recipes
  async getMedicationRecipes(forceRefresh = false): Promise<MedicationRecipe[]> {
    if (!forceRefresh && cachedRecipes && (Date.now() - recipesCacheTimestamp < CACHE_TTL_MS)) {
      return cachedRecipes;
    }
    try {
      const q = query(collection(db, MEDICATIONS_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const recipes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicationRecipe));
      cachedRecipes = recipes;
      recipesCacheTimestamp = Date.now();
      return recipes;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, MEDICATIONS_COLLECTION);
      return cachedRecipes || [];
    }
  },

  async getMedicationRecipesByWorker(workerId: string): Promise<MedicationRecipe[]> {
    // Si ya tenemos las recetas en memoria, filtrar directamente sin consultar Firestore
    if (cachedRecipes && cachedRecipes.length > 0) {
      return cachedRecipes.filter(r => r.workerId === workerId);
    }
    try {
      const q = query(
        collection(db, MEDICATIONS_COLLECTION),
        where('workerId', '==', workerId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicationRecipe));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, MEDICATIONS_COLLECTION);
      return [];
    }
  },

  async addMedicationRecipe(recipeData: Omit<MedicationRecipe, 'id' | 'prescribedBy' | 'createdAt'> & { createdAt?: any }): Promise<string> {
    try {
      // Clean undefined and invalid properties to prevent Firestore errors
      const cleanedData: Record<string, any> = {};
      Object.entries(recipeData).forEach(([key, val]) => {
        if (val !== undefined) {
          if (val instanceof Date) {
            if (!isNaN(val.getTime())) {
              cleanedData[key] = val;
            }
          } else if (typeof val === 'number') {
            cleanedData[key] = isNaN(val) ? 1 : val;
          } else {
            cleanedData[key] = val;
          }
        }
      });

      const docRef = await addDoc(collection(db, MEDICATIONS_COLLECTION), {
        ...cleanedData,
        status: cleanedData.status || 'pending',
        prescribedBy: auth.currentUser?.uid || 'anonymous',
        createdAt: cleanedData.createdAt || serverTimestamp(),
      });
      
      if (cachedRecipes) {
        cachedRecipes = [{ 
          id: docRef.id, 
          ...cleanedData, 
          status: cleanedData.status || 'pending', 
          prescribedBy: auth.currentUser?.uid || 'anonymous',
          createdAt: new Date().toISOString()
        } as MedicationRecipe, ...cachedRecipes];
      }
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, MEDICATIONS_COLLECTION);
      return '';
    }
  },

  async updateMedicationRecipeStatus(recipeId: string, status: 'pending' | 'delivered', deliveredBy?: string): Promise<void> {
    try {
      const docRef = doc(db, MEDICATIONS_COLLECTION, recipeId);
      await updateDoc(docRef, {
        status,
        deliveredBy: deliveredBy || auth.currentUser?.uid || 'Sistema',
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (cachedRecipes) {
        cachedRecipes = cachedRecipes.map(r => r.id === recipeId ? { 
          ...r, 
          status,
          deliveredBy: status === 'delivered' ? (deliveredBy || auth.currentUser?.uid || 'Sistema') : undefined,
          deliveredAt: status === 'delivered' ? new Date().toISOString() : undefined,
          updatedAt: new Date().toISOString()
        } : r);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${MEDICATIONS_COLLECTION}/${recipeId}`);
      throw error;
    }
  },

  async updateMedicationRecipe(recipeId: string, updates: Partial<MedicationRecipe>): Promise<void> {
    try {
      const docRef = doc(db, MEDICATIONS_COLLECTION, recipeId);
      const cleanUpdates: Record<string, any> = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      // Quitar campos undefined para no generar errores en Firestore
      Object.keys(cleanUpdates).forEach(key => {
        if (cleanUpdates[key] === undefined) {
          delete cleanUpdates[key];
        }
      });
      await updateDoc(docRef, cleanUpdates);
      if (cachedRecipes) {
        cachedRecipes = cachedRecipes.map(r => r.id === recipeId ? { 
          ...r, 
          ...cleanUpdates,
          updatedAt: new Date().toISOString()
        } : r);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${MEDICATIONS_COLLECTION}/${recipeId}`);
      throw error;
    }
  },

  async revertMedicationRecipeDelivery(recipeId: string): Promise<void> {
    try {
      const docRef = doc(db, MEDICATIONS_COLLECTION, recipeId);
      const updates = {
        status: 'pending',
        deliveredBy: null,
        deliveredAt: null,
        deliveryNotes: null,
        deliveryOfficer: null,
        isDeliveredToRepresentative: false,
        representativeFullName: null,
        representativeDni: null,
        representativeRelationship: null,
        representativePhone: null,
        updatedAt: serverTimestamp()
      };
      await updateDoc(docRef, updates);
      if (cachedRecipes) {
        cachedRecipes = cachedRecipes.map(r => r.id === recipeId ? { 
          ...r, 
          status: 'pending',
          deliveredBy: undefined,
          deliveredAt: undefined,
          deliveryNotes: undefined,
          deliveryOfficer: undefined,
          isDeliveredToRepresentative: false,
          representativeFullName: undefined,
          representativeDni: undefined,
          representativeRelationship: undefined,
          representativePhone: undefined,
          updatedAt: new Date().toISOString()
        } : r);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${MEDICATIONS_COLLECTION}/${recipeId}`);
      throw error;
    }
  },

  async deleteMedicationRecipe(recipeId: string): Promise<void> {
    try {
      const docRef = doc(db, MEDICATIONS_COLLECTION, recipeId);
      await deleteDoc(docRef);
      if (cachedRecipes) {
        cachedRecipes = cachedRecipes.filter(r => r.id !== recipeId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${MEDICATIONS_COLLECTION}/${recipeId}`);
      throw error;
    }
  },

  /**
   * Reclasificación masiva controlada en Firestore (Opción 2 solicitada):
   * Escanea y moviliza de 'medical_supply' a 'medical_derivation' aquellos
   * registros que corresponden a exámenes de laboratorio, consultas, ecos o estudios clínicos.
   *
   * Garantías estrictas aplicadas:
   * 1. Preserva 100% intacto el estatus ('delivered' o 'pending', fecha y funcionario de entrega).
   * 2. NO selecciona opciones de la Red Médica Municipal (deja derivaciones intactas sin forzar centros).
   * 3. NO modifica las fichas de los ciudadanos/pacientes (workers) ni historias médicas.
   * 4. Se ejecuta de forma segura en segundo plano sin botones invasivos en la interfaz.
   */
  async reclassifyClinicalSuppliesToDerivations(
    recipes: MedicationRecipe[]
  ): Promise<{ reclassifiedCount: number; reclassifiedIds: string[] }> {
    const toReclassify = recipes.filter(r => 
      r.category !== 'medical_derivation' && isClinicalDerivationItem(r)
    );

    if (toReclassify.length === 0) {
      return { reclassifiedCount: 0, reclassifiedIds: [] };
    }

    const reclassifiedIds: string[] = [];

    for (const recipe of toReclassify) {
      try {
        const docRef = doc(db, MEDICATIONS_COLLECTION, recipe.id);
        const updates: Record<string, any> = {
          category: 'medical_derivation',
          updatedAt: serverTimestamp(),
        };

        if (!recipe.derivationReason) {
          updates.derivationReason = recipe.medication || recipe.supplyName || 'Estudio / Atención Asistencial';
        }
        if (!recipe.derivationService) {
          updates.derivationService = recipe.supplyName || recipe.medication || 'Atención Médica / Estudio Clínico';
        }

        // status, deliveredAt, deliveredBy, deliveryOfficer, derivationCenter permanecen 100% INTACTOS
        await updateDoc(docRef, updates);
        reclassifiedIds.push(recipe.id);
      } catch (err) {
        console.error(`Error al reclasificar registro ${recipe.id}:`, err);
      }
    }

    if (cachedRecipes && reclassifiedIds.length > 0) {
      cachedRecipes = cachedRecipes.map(r => {
        if (reclassifiedIds.includes(r.id)) {
          return {
            ...r,
            category: 'medical_derivation',
            derivationReason: r.derivationReason || r.medication || r.supplyName || 'Estudio / Atención Asistencial',
            derivationService: r.derivationService || r.supplyName || r.medication || 'Atención Médica / Estudio Clínico',
          };
        }
        return r;
      });
    }

    return { reclassifiedCount: reclassifiedIds.length, reclassifiedIds };
  },

  async resetAllDatabase(): Promise<void> {
    try {
      // 1. Delete all workers
      const workersSnapshot = await getDocs(collection(db, WORKERS_COLLECTION));
      for (const workerDoc of workersSnapshot.docs) {
        const historyRef = doc(db, `${WORKERS_COLLECTION}/${workerDoc.id}/medical_history/baseline`);
        try { await deleteDoc(historyRef); } catch(e){}
        const evalsCol = collection(db, `${WORKERS_COLLECTION}/${workerDoc.id}/evaluations`);
        const evalsSnapshot = await getDocs(evalsCol);
        for (const evalDoc of evalsSnapshot.docs) {
          try { await deleteDoc(doc(db, `${WORKERS_COLLECTION}/${workerDoc.id}/evaluations/${evalDoc.id}`)); } catch(e){}
        }
        await deleteDoc(doc(db, WORKERS_COLLECTION, workerDoc.id));
      }

      // 2. Delete all medication recipes
      const medsSnapshot = await getDocs(collection(db, MEDICATIONS_COLLECTION));
      for (const medDoc of medsSnapshot.docs) {
        await deleteDoc(doc(db, MEDICATIONS_COLLECTION, medDoc.id));
      }
    } catch (error) {
      console.error("Error resetting database:", error);
      throw error;
    }
  }
};
