import type {
  InstitutionEntry,
  Lang,
  PostcodeEntry,
  SubmissionPayload,
  SubmissionReceipt,
} from '@zego/shared';

/**
 * In development Vite proxies /api to the server, so the browser makes a
 * same-origin request and never sees a CORS preflight. Set VITE_API_URL
 * when the two are deployed apart.
 */
const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    // Offline, DNS, server down — never a status code.
    throw new ApiError(0, 'network');
  }

  const body = (await response.json().catch(() => null)) as
    | { error?: string; details?: unknown }
    | T
    | null;

  if (!response.ok) {
    const payload = body as { error?: string; details?: unknown } | null;
    throw new ApiError(response.status, payload?.error ?? response.statusText, payload?.details);
  }

  return body as T;
}

export interface ReferenceLists {
  institutions: InstitutionEntry[];
  majors: string[];
}

/**
 * Fills in anything the response is missing.
 *
 * These lists are cached for an hour, so a browser can still be holding
 * a reply from before a field was added to them. Everything downstream
 * declares these as present, so this is where that is made true — the
 * form degrades to fewer suggestions instead of failing to render.
 */
export async function fetchLists(lang: Lang): Promise<ReferenceLists> {
  const raw = await request<Partial<ReferenceLists>>(`/reference?lang=${lang}`);
  return {
    institutions: raw.institutions ?? [],
    majors: raw.majors ?? [],
  };
}

/**
 * One post code, or null when it is not a Thai one.
 *
 * These replies are cached for a day, so a browser can be holding one
 * from before a field existed — `singleProvince` and the province on
 * each district were added after the first release. Filling them in here
 * keeps a stale reply behaving like the single-province codes it was
 * written for, instead of silently reading as "this code has two".
 */
export async function fetchPostcode(code: string): Promise<PostcodeEntry | null> {
  let raw: Partial<PostcodeEntry>;
  try {
    raw = await request<Partial<PostcodeEntry>>(`/reference/postcodes/${code}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }

  const provinceTh = raw.provinceTh ?? '';
  const provinceEn = raw.provinceEn ?? '';

  return {
    provinceTh,
    provinceEn,
    singleProvince: raw.singleProvince ?? provinceTh !== '',
    districts: (raw.districts ?? []).map((district) => ({
      ...district,
      provinceTh: district.provinceTh ?? provinceTh,
      provinceEn: district.provinceEn ?? provinceEn,
    })),
  };
}

export function submitApplication(payload: SubmissionPayload): Promise<SubmissionReceipt> {
  return request<SubmissionReceipt>('/applications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
