const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const resolveUrl = (path, params = {}) => {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    url.searchParams.set(key, value);
  });
  return url;
};

const parseFilename = (contentDisposition, fallback) => {
  const match = /filename="?([^"]+)"?/i.exec(contentDisposition || '');
  return match?.[1] || fallback;
};

export const downloadReport = async ({
  path,
  token,
  format = 'csv',
  params = {},
  fallbackFilename = `report.${format}`,
} = {}) => {
  const url = resolveUrl(path, { ...params, format });
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: token
      ? { Authorization: `Bearer ${token}` }
      : undefined,
  });

  if (!response.ok) {
    let message = 'Unable to download the report.';
    try {
      const errorPayload = await response.json();
      message = errorPayload?.message || errorPayload?.data?.message || message;
    } catch (_error) {
      // Ignore JSON parsing failures and keep the fallback message.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const fileName = parseFilename(response.headers.get('content-disposition'), fallbackFilename);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};
