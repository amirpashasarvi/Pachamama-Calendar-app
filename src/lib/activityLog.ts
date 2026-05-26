import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { ActivityAction, ActivityEntityType } from '../types';

interface LogParams {
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  summary: string;
  userName: string;
  userEmail: string;
}

export async function logActivity(params: LogParams): Promise<void> {
  try {
    await addDoc(collection(db, 'activityLog'), {
      ...params,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Never block the main operation if logging fails
  }
}
