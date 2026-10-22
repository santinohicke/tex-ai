interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const queryWindowMs = 60 * 1000; // 1 minuto
const maxQueriesPerWindow = 12; // Máximo 12 consultas de chat por minuto
const queryMap = new Map<string, RateLimitRecord>();

const loginWindowMs = 60 * 1000;
const maxLoginsPerWindow = 5; // Máximo 5 intentos de login fallidos por minuto
const loginMap = new Map<string, RateLimitRecord>();

function cleanup(map: Map<string, RateLimitRecord>, now: number) {
  if (map.size > 500) {
    for (const [key, record] of map.entries()) {
      if (now > record.resetAt) {
        map.delete(key);
      }
    }
  }
}

/**
 * Control de consultas a la API de Chat (12 req/min).
 */
export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  cleanup(queryMap, now);

  const record = queryMap.get(ip);
  if (!record || now > record.resetAt) {
    queryMap.set(ip, {
      count: 1,
      resetAt: now + queryWindowMs,
    });
    return { allowed: true, remaining: maxQueriesPerWindow - 1 };
  }

  if (record.count >= maxQueriesPerWindow) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: maxQueriesPerWindow - record.count };
}

/**
 * Control contra ataques de fuerza bruta en el Login (5 intentos/min).
 */
export function checkLoginRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  cleanup(loginMap, now);

  const record = loginMap.get(ip);
  if (!record || now > record.resetAt) {
    loginMap.set(ip, {
      count: 1,
      resetAt: now + loginWindowMs,
    });
    return { allowed: true, remaining: maxLoginsPerWindow - 1 };
  }

  if (record.count >= maxLoginsPerWindow) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: maxLoginsPerWindow - record.count };
}
