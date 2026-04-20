let solrUrl = null;
let solrReady = false;

const RESERVED_QUERY_CHARS_REGEX = /[+\-&|!(){}\[\]^"~*?:\\/]/g;

const sanitizeSearchTerm = (value = '') =>
  String(value)
    .replace(RESERVED_QUERY_CHARS_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const quoteSolrValue = (value) => {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }
  return `"${text.replace(/(["\\])/g, '\\$1')}"`;
};

const toStringArray = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry ?? '').split(','))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const getConfiguredSolrUrl = () => {
  const raw = process.env.SOLR_URL ?? '';
  return raw.trim().replace(/\/$/, '');
};

const postJson = async (path, payload) => {
  const response = await fetch(`${solrUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Solr request failed (${response.status}): ${bodyText}`);
  }

  return response.json();
};

const querySolr = async ({
  query,
  filter = [],
  limit = 20,
  offset = 0,
  sort = 'score desc',
  fields = 'sourceId_s,score',
}) => {
  if (!isSolrReady()) {
    return null;
  }

  try {
    const payload = {
      query: query || '*:*',
      filter,
      limit,
      offset,
      sort,
      fields,
    };

    return await postJson('/query?wt=json', payload);
  } catch (_error) {
    return null;
  }
};

const buildGymSearchDoc = (gym) => {
  const amenities = toStringArray(gym?.amenities);
  const tags = toStringArray(gym?.tags);
  const keyFeatures = toStringArray(gym?.keyFeatures);

  const textParts = [
    gym?.name,
    gym?.description,
    gym?.location?.city,
    gym?.location?.state,
    ...amenities,
    ...tags,
    ...keyFeatures,
  ].filter(Boolean);

  return {
    id: `gym_${gym._id}`,
    type_s: 'gym',
    sourceId_s: String(gym._id),
    name_s: gym?.name ?? '',
    city_s: gym?.location?.city ?? '',
    state_s: gym?.location?.state ?? '',
    amenities_ss: amenities,
    tags_ss: tags,
    status_s: gym?.status ?? 'active',
    isPublished_b: Boolean(gym?.isPublished),
    createdAt_dt: gym?.createdAt ? new Date(gym.createdAt).toISOString() : new Date().toISOString(),
    updatedAt_dt: gym?.updatedAt ? new Date(gym.updatedAt).toISOString() : new Date().toISOString(),
    _text_: textParts.join(' '),
  };
};

const buildProductSearchDoc = (product) => {
  const textParts = [
    product?.name,
    product?.description,
    product?.category,
  ].filter(Boolean);

  return {
    id: `product_${product._id}`,
    type_s: 'product',
    sourceId_s: String(product._id),
    name_s: product?.name ?? '',
    category_s: product?.category ?? '',
    status_s: product?.status ?? 'available',
    isPublished_b: Boolean(product?.isPublished),
    price_f: Number(product?.price ?? 0),
    stock_i: Number(product?.stock ?? 0),
    createdAt_dt: product?.createdAt ? new Date(product.createdAt).toISOString() : new Date().toISOString(),
    updatedAt_dt: product?.updatedAt ? new Date(product.updatedAt).toISOString() : new Date().toISOString(),
    _text_: textParts.join(' '),
  };
};

export const initSolr = async () => {
  solrUrl = getConfiguredSolrUrl();

  if (!solrUrl) {
    solrReady = false;
    console.log('Solr is disabled: SOLR_URL is not configured.');
    return;
  }

  try {
    const response = await fetch(`${solrUrl}/select?wt=json&q=*:*&rows=0`);
    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status}`);
    }

    solrReady = true;
    console.log(`Solr connected at ${solrUrl}`);
  } catch (error) {
    solrReady = false;
    console.warn(`Solr unavailable (${error.message}). Falling back to MongoDB search.`);
  }
};

export const isSolrReady = () => Boolean(solrReady && solrUrl);

export const indexGymDocument = async (gym) => {
  if (!isSolrReady() || !gym?._id) {
    return false;
  }

  try {
    await postJson('/update?commit=true&wt=json', [buildGymSearchDoc(gym)]);
    return true;
  } catch (_error) {
    return false;
  }
};

export const removeGymDocument = async (gymId) => {
  if (!isSolrReady() || !gymId) {
    return false;
  }

  try {
    await postJson('/update?commit=true&wt=json', { delete: { id: `gym_${gymId}` } });
    return true;
  } catch (_error) {
    return false;
  }
};

export const indexProductDocument = async (product) => {
  if (!isSolrReady() || !product?._id) {
    return false;
  }

  try {
    await postJson('/update?commit=true&wt=json', [buildProductSearchDoc(product)]);
    return true;
  } catch (_error) {
    return false;
  }
};

export const removeProductDocument = async (productId) => {
  if (!isSolrReady() || !productId) {
    return false;
  }

  try {
    await postJson('/update?commit=true&wt=json', { delete: { id: `product_${productId}` } });
    return true;
  } catch (_error) {
    return false;
  }
};

export const searchGymIds = async (searchTerm, {
  page = 1,
  limit = 20,
  city,
  amenities,
} = {}) => {
  const cleanedTerm = sanitizeSearchTerm(searchTerm);
  if (!cleanedTerm) {
    return null;
  }

  const filter = ['type_s:gym', 'status_s:active', 'isPublished_b:true'];
  const cityValue = quoteSolrValue(city);
  if (cityValue) {
    filter.push(`city_s:${cityValue}`);
  }

  toStringArray(amenities).forEach((amenity) => {
    const quoted = quoteSolrValue(amenity);
    if (quoted) {
      filter.push(`amenities_ss:${quoted}`);
    }
  });

  const offset = Math.max(0, (Number(page) - 1) * Number(limit));
  const rows = Math.max(1, Number(limit));

  const result = await querySolr({
    query: cleanedTerm,
    filter,
    offset,
    limit: rows,
    sort: 'score desc,updatedAt_dt desc',
  });

  if (!result?.response) {
    return null;
  }

  return {
    ids: (result.response.docs || [])
      .map((doc) => doc.sourceId_s)
      .filter(Boolean),
    total: Number(result.response.numFound || 0),
  };
};

export const searchProductIds = async (searchTerm, {
  page = 1,
  limit = 24,
  category,
  minPrice,
  maxPrice,
  inStock = false,
  sort = 'featured',
} = {}) => {
  const cleanedTerm = sanitizeSearchTerm(searchTerm);
  if (!cleanedTerm) {
    return null;
  }

  const filter = ['type_s:product', 'isPublished_b:true'];
  const categoryValue = quoteSolrValue(category);
  if (categoryValue) {
    filter.push(`category_s:${categoryValue}`);
  }

  if (inStock) {
    filter.push('status_s:available');
    filter.push('stock_i:[1 TO *]');
  }

  const min = Number(minPrice);
  if (Number.isFinite(min) && min >= 0) {
    filter.push(`price_f:[${min} TO *]`);
  }

  const max = Number(maxPrice);
  if (Number.isFinite(max) && max >= 0) {
    filter.push(`price_f:[* TO ${max}]`);
  }

  const sortMap = {
    priceLow: 'price_f asc',
    priceHigh: 'price_f desc',
    newest: 'createdAt_dt desc',
    featured: 'score desc,updatedAt_dt desc',
  };

  const offset = Math.max(0, (Number(page) - 1) * Number(limit));
  const rows = Math.max(1, Number(limit));

  const result = await querySolr({
    query: cleanedTerm,
    filter,
    offset,
    limit: rows,
    sort: sortMap[sort] || sortMap.featured,
  });

  if (!result?.response) {
    return null;
  }

  return {
    ids: (result.response.docs || [])
      .map((doc) => doc.sourceId_s)
      .filter(Boolean),
    total: Number(result.response.numFound || 0),
  };
};
