import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import { auth, db, hasFirebaseKeys } from '../firebase';
import { DailyListenerStat } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId || null
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const getLocalDateKey = (date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getLast7DateKeys = (): string[] => {
  const keys: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    keys.push(getLocalDateKey(dt));
  }
  return keys;
};

/**
 * Records a unique browser session listener visit/play once per day-session in Firestore.
 */
export async function recordListenerSession(source: 'visit' | 'play' = 'visit'): Promise<void> {
  if (!hasFirebaseKeys || !db || typeof window === 'undefined') return;
  const dateKey = getLocalDateKey();
  const storageKey = `buenisima_stat_${source}_${dateKey}`;
  try {
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, '1');
  } catch {
    // Ignore storage issues
  }

  const path = `listener_stats/${dateKey}`;
  try {
    const ref = doc(db, 'listener_stats', dateKey);
    await setDoc(
      ref,
      {
        date: dateKey,
        totalListeners: increment(1),
        peakListeners: increment(0),
        songRequests: increment(0),
        chatMessages: increment(0),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('Could not record listener session:', error);
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Non-fatal telemetry failure shouldn't break playback
    }
  }
}

/**
 * Updates today's peak concurrent listener count when Icecast reports a higher count.
 */
export async function recordPeakListenerCount(liveCount: number): Promise<void> {
  if (!hasFirebaseKeys || !db || !Number.isFinite(liveCount) || liveCount <= 0) return;
  const dateKey = getLocalDateKey();
  const sessionPeakKey = `buenisima_peak_${dateKey}`;
  try {
    const prevLocalPeak = Number(sessionStorage.getItem(sessionPeakKey) || '0');
    if (liveCount <= prevLocalPeak) return;
    sessionStorage.setItem(sessionPeakKey, String(liveCount));
  } catch {
    // Ignore
  }

  try {
    const ref = doc(db, 'listener_stats', dateKey);
    const snap = await getDoc(ref);
    const currentPeak = snap.exists() ? Number(snap.data()?.peakListeners || 0) : 0;
    if (liveCount > currentPeak) {
      await setDoc(
        ref,
        {
          date: dateKey,
          peakListeners: liveCount,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Increments today's WhatsApp song request counter in Firestore.
 */
export async function recordSongRequestEvent(): Promise<void> {
  if (!hasFirebaseKeys || !db) return;
  const dateKey = getLocalDateKey();
  try {
    await setDoc(
      doc(db, 'listener_stats', dateKey),
      {
        date: dateKey,
        songRequests: increment(1),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch {
    // Non-fatal
  }
}

export interface ListenerTrendsSummary {
  days: DailyListenerStat[];
  totalListeners7d: number;
  avgDailyListeners: number;
  peakListeners7d: number;
  totalSongRequests7d: number;
  totalChatMessages7d: number;
  registeredOyentesCount: number;
  todayCount: number;
  yesterdayCount: number;
  trendPercent: number;
}

/**
 * Pulls the last 7 days of listener trends from Firestore (`listener_stats`, `messages`, and `oyentes`).
 */
export async function fetchLast7DaysListenerTrends(): Promise<ListenerTrendsSummary> {
  const dateKeys = getLast7DateKeys();
  const startDate = dateKeys[0];

  const statsMap = new Map<string, DailyListenerStat>();
  for (const dk of dateKeys) {
    statsMap.set(dk, {
      date: dk,
      totalListeners: 0,
      peakListeners: 0,
      songRequests: 0,
      chatMessages: 0,
      updatedAt: ''
    });
  }

  let registeredOyentesCount = 0;

  if (hasFirebaseKeys && db) {
    // 1. Fetch daily stats docs for the last 7 days
    const statsPath = 'listener_stats';
    try {
      const statsQ = query(
        collection(db, statsPath),
        where('date', '>=', startDate),
        orderBy('date', 'asc'),
        limit(14)
      );
      const snap = await getDocs(statsQ);
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Partial<DailyListenerStat>;
        const key = d.date || docSnap.id;
        if (statsMap.has(key)) {
          statsMap.set(key, {
            date: key,
            totalListeners: Number(d.totalListeners || 0),
            peakListeners: Number(d.peakListeners || 0),
            songRequests: Number(d.songRequests || 0),
            chatMessages: Number(d.chatMessages || 0),
            updatedAt: d.updatedAt || ''
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, statsPath);
    }

    // 2. Correlate real chat messages from the last 7 days in `messages` collection
    const messagesPath = 'messages';
    try {
      const startIso = new Date(`${startDate}T00:00:00.000Z`).toISOString();
      const msgQ = query(
        collection(db, messagesPath),
        where('timestamp', '>=', startIso),
        orderBy('timestamp', 'desc'),
        limit(500)
      );
      const msgSnap = await getDocs(msgQ);
      const chatSendersByDay = new Map<string, Set<string>>();

      msgSnap.forEach((docSnap) => {
        const msg = docSnap.data() as { timestamp?: string; sender?: string; senderPhone?: string };
        if (!msg.timestamp) return;
        const dt = new Date(msg.timestamp);
        if (Number.isNaN(dt.getTime())) return;
        const key = getLocalDateKey(dt);
        const existing = statsMap.get(key);
        if (existing) {
          existing.chatMessages += 1;
          const senderKey = msg.senderPhone || msg.sender || docSnap.id;
          if (!chatSendersByDay.has(key)) chatSendersByDay.set(key, new Set());
          chatSendersByDay.get(key)!.add(senderKey);
        }
      });

      // Ensure days with active chat participants never display below unique active chatters
      chatSendersByDay.forEach((senders, key) => {
        const existing = statsMap.get(key);
        if (existing && existing.totalListeners < senders.size) {
          existing.totalListeners = senders.size;
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, messagesPath);
    }

    // 3. Count unique listeners from `oyentes` or `messages`
    try {
      const oyentesSnap = await getDocs(query(collection(db, 'oyentes'), limit(500)));
      registeredOyentesCount = oyentesSnap.size;
    } catch {
      // Optional collection fallback
      registeredOyentesCount = 0;
    }
  }

  const days = dateKeys.map((dk) => statsMap.get(dk)!);
  const totalListeners7d = days.reduce((acc, d) => acc + d.totalListeners, 0);
  const peakListeners7d = days.reduce((max, d) => Math.max(max, d.peakListeners), 0);
  const totalSongRequests7d = days.reduce((acc, d) => acc + d.songRequests, 0);
  const totalChatMessages7d = days.reduce((acc, d) => acc + d.chatMessages, 0);
  const avgDailyListeners = Math.round((totalListeners7d / 7) * 10) / 10;

  const todayCount = days[days.length - 1]?.totalListeners || 0;
  const yesterdayCount = days[days.length - 2]?.totalListeners || 0;
  const trendPercent =
    yesterdayCount === 0
      ? todayCount > 0
        ? 100
        : 0
      : Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);

  return {
    days,
    totalListeners7d,
    avgDailyListeners,
    peakListeners7d,
    totalSongRequests7d,
    totalChatMessages7d,
    registeredOyentesCount,
    todayCount,
    yesterdayCount,
    trendPercent
  };
}
