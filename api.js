const API_ORIGIN = 'https://lingsuan.top';

export function buildRedeemEndpoint(timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const query = new URLSearchParams();
  if (timezone) query.set('timezone', timezone);
  const suffix = query.size ? `?${query}` : '';
  return `${API_ORIGIN}/api/v1/redeem${suffix}`;
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { detail: text } : null;
}

export async function redeemCode({ authorization, code, timezone, fetchImpl = fetch }) {
  const response = await fetchImpl(buildRedeemEndpoint(timezone), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authorization,
    },
    body: JSON.stringify({ code }),
  });
  const data = await parseResponseBody(response);

  if (response.ok) {
    return { ok: true, status: response.status, data };
  }

  return {
    ok: false,
    status: response.status,
    message: data?.detail ?? data?.message ?? `HTTP ${response.status}`,
    data,
  };
}
