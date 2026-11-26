import { readonly, shallowRef } from 'vue';
import type { AuthenticatedUserResponse } from '../api/auth';

export const OPERATION_LOGS_FORMAL_META = 'requiresOperationLogsFormalIdentity';
export function requiresOperationLogsIdentity(matched: readonly { meta: Record<string, unknown> }[]) {
  return matched.some((record) => record.meta[OPERATION_LOGS_FORMAL_META] === true);
}

export function parseOperationLogsIdentity(raw: unknown): AuthenticatedUserResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (v.identitySource !== 'trusted_proxy' || v.formalIdentityBound !== true ||
    typeof v.id !== 'number' || !Number.isSafeInteger(v.id) || v.id <= 0 ||
    typeof v.username !== 'string' || !/^[A-Za-z0-9._-]{1,50}$/.test(v.username) ||
    typeof v.realName !== 'string' || v.realName.length > 100 ||
    !Array.isArray(v.roleCodes) || v.roleCodes.length > 32 ||
    !v.roleCodes.every((r) => typeof r === 'string' && /^[a-z][a-z0-9_]{0,49}$/.test(r)) ||
    !v.roleCodes.some((r) => ['admin', 'finance', 'approver'].includes(r))) return null;
  return { id: v.id, username: v.username, realName: v.realName,
    roleCodes: [...v.roleCodes], identitySource: 'trusted_proxy', formalIdentityBound: true };
}

type Admission = { status: 'unverified' | 'checking' | 'authorized' | 'denied';
  identity: AuthenticatedUserResponse | null };

// A new attempt, departure or authorization failure invalidates every older
// completion. This state is scoped to the log page, not the legacy role picker.
export function createOperationLogsAdmission(timeoutMs = 5000) {
  const state = shallowRef<Admission>({ status: 'unverified', identity: null });
  let generation = 0;
  let controller: AbortController | null = null;
  function invalidate(status: 'unverified' | 'denied' = 'unverified') {
    generation += 1;
    controller?.abort();
    controller = null;
    state.value = { status, identity: null };
  }
  async function authorize(load: (signal: AbortSignal) => Promise<unknown>) {
    invalidate();
    const attempt = generation;
    const pending = new AbortController();
    controller = pending;
    state.value = { status: 'checking', identity: null };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancelled = new Promise<never>((_, reject) => {
      pending.signal.addEventListener('abort', () => reject(new Error('identity_unavailable')), { once: true });
      timer = setTimeout(() => pending.abort(), timeoutMs);
    });
    try {
      const identity = parseOperationLogsIdentity(await Promise.race([load(pending.signal), cancelled]));
      if (attempt !== generation) return false;
      state.value = { status: identity ? 'authorized' : 'denied', identity };
      return identity !== null;
    } catch {
      if (attempt === generation) state.value = { status: 'denied', identity: null };
      return false;
    } finally {
      clearTimeout(timer);
      if (controller === pending) controller = null;
    }
  }
  return { state: readonly(state), authorize, invalidate };
}

export const operationLogsAdmission = createOperationLogsAdmission();
