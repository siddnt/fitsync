import { useMemo, useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import SellerProductForm from './SellerProductForm.jsx';
import { SubmissionError } from 'redux-form';
import {
  buildCategoryOptions,
  categoryOptions,
  createSubmissionHandler,
  normaliseCategoryValue,
} from './helpers.js';
import {
  useLazyGetSellerProductsQuery,
  useCreateSellerProductMutation,
  useUpdateSellerProductMutation,
  useDeleteSellerProductMutation,
} from '../../../services/sellerApi.js';
import { formatCurrency, formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
import {
  openProductPanel,
  closeProductPanel,
  setFilterStatus,
} from '../../../features/seller/sellerSlice.js';
import { reset } from 'redux-form';
import SearchSuggestInput from '../../../components/dashboard/SearchSuggestInput.jsx';
import { matchesPrefix, matchesAcrossFields } from '../../../utils/search.js';
import useConfirmationModal from '../../../hooks/useConfirmationModal.js';
import '../Dashboard.css';

const filters = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
  { key: 'available', label: 'Available' },
  { key: 'out-of-stock', label: 'Out of stock' },
];

const LOW_STOCK_THRESHOLD = 5;
const PRODUCT_PAGE_LIMIT = 24;

const mergeUniqueProducts = (currentProducts = [], nextProducts = []) => {
  const productMap = new Map(currentProducts.map((product) => [product.id, product]));

  nextProducts.forEach((product) => {
    if (!product?.id) {
      return;
    }

    productMap.set(product.id, product);
  });

  return Array.from(productMap.values());
};

const buildProductFormData = (fields, file) => {
  const formData = new FormData();
  const supportsFile = typeof File !== 'undefined';

  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (value instanceof Date) {
      formData.append(key, value.toISOString());
      return;
    }

    formData.append(key, value);
  });

  if (supportsFile && file instanceof File) {
    formData.append('image', file);
  }

  return formData;
};

// Normalise server values so price widgets stay consistent across edge cases.
const derivePricingDetails = (product) => {
  const rawMrp = product?.mrp ?? product?.price ?? 0;
  const rawPrice = product?.price ?? rawMrp;

  const mrpValue = Number(rawMrp);
  const priceValue = Number(rawPrice);

  const safeMrp = Number.isFinite(mrpValue) && mrpValue > 0 ? mrpValue : (Number.isFinite(priceValue) && priceValue > 0 ? priceValue : 0);
  const safePrice = Number.isFinite(priceValue) && priceValue > 0 ? priceValue : safeMrp;

  if (!safeMrp || safePrice >= safeMrp) {
    return {
      mrp: safeMrp,
      price: safePrice,
      hasDiscount: false,
      discountPercentage: 0,
    };
  }

  const discount = Math.min(100, Math.max(0, Math.round(((safeMrp - safePrice) / safeMrp) * 100)));

  return {
    mrp: safeMrp,
    price: safePrice,
    hasDiscount: discount > 0,
    discountPercentage: discount,
  };
};

const mapInitialValues = (product) => {
  if (!product) {
    return {
      status: 'available',
      mrp: '',
      price: '',
      image: '',
      existingImageUrl: null,
    };
  }

  const mrpValue = product.mrp ?? product.price ?? '';
  const salePrice = product.price ?? '';
  const hasDiscount = Number(mrpValue) > Number(salePrice);

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: normaliseCategoryValue(product.category),
    mrp: mrpValue === null || mrpValue === undefined ? '' : mrpValue,
    price: hasDiscount ? salePrice : '',
    stock: product.stock,
    status: typeof product.status === 'string' ? product.status.toLowerCase() : 'available',
    image: '__existing__',
    existingImageUrl: product.image ?? null,
  };
};

const InventoryPage = () => {
  const dispatch = useDispatch();
  const { editingProductId, isProductPanelOpen, filterStatus } = useSelector((state) => state.seller);

  const [fetchSellerProducts] = useLazyGetSellerProductsQuery();
  const [createProduct] = useCreateSellerProductMutation();
  const [updateProduct] = useUpdateSellerProductMutation();
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteSellerProductMutation();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [productsError, setProductsError] = useState(null);
  const [productPagination, setProductPagination] = useState({
    hasMore: false,
    nextCursor: null,
  });

  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingProductId) ?? null,
    [products, editingProductId],
  );

  const categoryFilterOptions = useMemo(
    () => buildCategoryOptions(products.map((product) => product.category), []),
    [products],
  );

  const productFormCategoryOptions = useMemo(
    () => buildCategoryOptions(
      [editingProduct?.category, ...products.map((product) => product.category)],
      categoryOptions,
    ),
    [editingProduct?.category, products],
  );

  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minStock, setMinStock] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('available');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const { confirm, confirmationModal } = useConfirmationModal();

  const fetchProductPage = useCallback(async ({ cursor = null, reset = false } = {}) => {
    if (reset) {
      setIsLoading(true);
      setProductsError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = await fetchSellerProducts({
        pagination: 'cursor',
        limit: PRODUCT_PAGE_LIMIT,
        ...(cursor ? { cursor } : {}),
      }).unwrap();

      const pageProducts = Array.isArray(response?.data?.products) ? response.data.products : [];
      const pagination = response?.data?.pagination ?? {};

      setProducts((current) => (reset ? pageProducts : mergeUniqueProducts(current, pageProducts)));
      setProductPagination({
        hasMore: Boolean(pagination?.hasMore),
        nextCursor: pagination?.nextCursor ?? null,
      });

      return response;
    } catch (requestError) {
      if (reset) {
        setProducts([]);
        setProductPagination({ hasMore: false, nextCursor: null });
        setProductsError(requestError);
      } else {
        setErrorNotice(requestError?.data?.message ?? 'Unable to load more products right now.');
      }

      throw requestError;
    } finally {
      if (reset) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [fetchSellerProducts]);

  useEffect(() => {
    fetchProductPage({ reset: true }).catch(() => {});
  }, [fetchProductPage]);

  const filteredProducts = useMemo(() => {
    let list = products.slice();

    // status-based filters
    if (filterStatus === 'published') {
      list = list.filter((product) => product.isPublished);
    } else if (filterStatus === 'draft') {
      list = list.filter((product) => !product.isPublished);
    } else if (filterStatus !== 'all') {
      list = list.filter((product) => (product.status ?? '').toLowerCase() === filterStatus);
    }

    // search by name/category/description/status
    if (searchText.trim()) {
      list = list.filter((product) =>
        matchesAcrossFields(
          [product.name, product.category, product.description, product.status],
          searchText,
        ),
      );
    }

    // category filter
    if (categoryFilter) {
      list = list.filter((p) => (p.category || '').toLowerCase() === categoryFilter.toLowerCase());
    }

    // price range
    const minP = minPrice === '' ? null : Number(minPrice);
    const maxP = maxPrice === '' ? null : Number(maxPrice);
    if (!Number.isNaN(minP) && minP !== null) {
      list = list.filter((p) => (Number(p.price) || 0) >= minP);
    }
    if (!Number.isNaN(maxP) && maxP !== null) {
      list = list.filter((p) => (Number(p.price) || 0) <= maxP);
    }

    // stock
    const minS = minStock === '' ? null : Number(minStock);
    if (!Number.isNaN(minS) && minS !== null) {
      list = list.filter((p) => (Number(p.stock) || 0) >= minS);
    }

    return list;
  }, [products, filterStatus, searchText, categoryFilter, minPrice, maxPrice, minStock]);

  const searchSuggestions = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const suggestions = [];
    const seen = new Set();

    products.forEach((product) => {
      [
        {
          value: product.name,
          meta: `${product.category ? formatStatus(product.category) : 'Uncategorised'} • ${formatStatus(product.status ?? 'available')}`,
        },
        {
          value: product.category,
          meta: `Category • ${product.name ?? 'Unnamed product'}`,
        },
      ].forEach((entry, index) => {
        const normalized = entry.value?.toString().trim();
        if (!normalized) {
          return;
        }
        const lower = normalized.toLowerCase();
        if (!matchesPrefix(lower, query)) {
          return;
        }
        const key = `${index}:${lower}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        suggestions.push({
          id: key,
          label: normalized,
          meta: entry.meta,
        });
      });
    });

    return suggestions;
  }, [products, searchText]);

  const filteredProductIds = useMemo(
    () => filteredProducts.map((product) => product.id),
    [filteredProducts],
  );

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedProductIds.includes(product.id)),
    [products, selectedProductIds],
  );

  const allFilteredSelected = filteredProductIds.length > 0
    && filteredProductIds.every((productId) => selectedProductIds.includes(productId));

  const approvalError = productsError?.status === 403 ? productsError : null;
  const approvalMessage = approvalError?.data?.message
    ?? 'Your seller account is awaiting admin approval. Hang tight—you can start listing products as soon as you are activated.';

  const createPreviewUrl = useCallback((file) => {
    if (!file) {
      return null;
    }
    const hasWindowUrl = typeof window !== 'undefined'
      && window.URL
      && typeof window.URL.createObjectURL === 'function';
    if (hasWindowUrl) {
      return window.URL.createObjectURL(file);
    }

    const hasGlobalUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
    return hasGlobalUrl ? URL.createObjectURL(file) : null;
  }, []);

  const revokePreviewUrl = useCallback((url) => {
    if (!url) {
      return;
    }
    const hasWindowUrl = typeof window !== 'undefined'
      && window.URL
      && typeof window.URL.revokeObjectURL === 'function';
    if (hasWindowUrl) {
      window.URL.revokeObjectURL(url);
      return;
    }

    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }, []);

  const resetImageSelection = useCallback(() => {
    setImageFile(null);
    setImagePreviewUrl((prevUrl) => {
      revokePreviewUrl(prevUrl);
      return null;
    });
  }, [revokePreviewUrl]);

  const handleImageSelect = useCallback((file) => {
    setImageFile(file ?? null);
    setImagePreviewUrl((prevUrl) => {
      revokePreviewUrl(prevUrl);
      return createPreviewUrl(file ?? null);
    });
  }, [createPreviewUrl, revokePreviewUrl]);

  useEffect(() => () => {
    if (imagePreviewUrl) {
      revokePreviewUrl(imagePreviewUrl);
    }
  }, [imagePreviewUrl, revokePreviewUrl]);

  useEffect(() => {
    const visibleIds = new Set(filteredProductIds);
    setSelectedProductIds((current) => current.filter((productId) => visibleIds.has(productId)));
  }, [filteredProductIds]);

  const buildProductUpdateFields = useCallback((product, overrides = {}) => {
    const pricing = derivePricingDetails(product);

    return {
      name: product.name,
      description: product.description ?? '',
      category: normaliseCategoryValue(product.category),
      price: pricing.price,
      mrp: pricing.mrp,
      stock: product.stock ?? 0,
      status: product.status || 'available',
      isPublished: Boolean(product.isPublished),
      ...overrides,
    };
  }, []);

  const runProductBatchUpdate = useCallback(async (targetProducts, buildOverrides, successMessage) => {
    if (!targetProducts.length) {
      return;
    }

    setNotice(null);
    setErrorNotice(null);
    setIsBulkUpdating(true);

    try {
      for (const product of targetProducts) {
        const formData = buildProductFormData(buildProductUpdateFields(product, buildOverrides(product)));
        await updateProduct({ id: product.id, body: formData }).unwrap();
      }

      setSelectedProductIds([]);
      setNotice(successMessage);
      await fetchProductPage({ reset: true });
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to apply the selected bulk action.');
    } finally {
      setIsBulkUpdating(false);
    }
  }, [buildProductUpdateFields, fetchProductPage, updateProduct]);

  const openCreatePanel = () => {
    setNotice(null);
    setErrorNotice(null);
    resetImageSelection();
    dispatch(openProductPanel(null));
    dispatch(reset('sellerProduct'));
  };

  const openEditPanel = (product) => {
    setNotice(null);
    setErrorNotice(null);
    resetImageSelection();
    dispatch(openProductPanel(product.id));
  };

  const handleDelete = async (product) => {
    if (!product) {
      return;
    }
    setNotice(null);
    setErrorNotice(null);
    const confirmed = await confirm({
      title: 'Delete product',
      message: `Remove ${product.name}? This deletes the listing from your inventory and cannot be undone.`,
      confirmLabel: 'Delete product',
      cancelLabel: 'Keep product',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    try {
      await deleteProduct(product.id).unwrap();
      setNotice('Product removed from inventory.');
      setSelectedProductIds((current) => current.filter((productId) => productId !== product.id));
      await fetchProductPage({ reset: true });
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to delete this product.');
    }
  };

  const handleTogglePublish = async (product) => {
    if (!product) return;
    setNotice(null);
    setErrorNotice(null);

    try {
      const formData = buildProductFormData(buildProductUpdateFields(product, { isPublished: !product.isPublished }));

      await updateProduct({ id: product.id, body: formData }).unwrap();
      setNotice(product.isPublished ? 'Product unpublished.' : 'Product published.');
      await fetchProductPage({ reset: true });
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to update product listing.');
    }
  };

  const submitProduct = createSubmissionHandler(async (values) => {
    const mrpValue = Number(values.mrp ?? 0);
    const sellingPriceProvided = !(values.price === undefined || values.price === null || values.price === '');
    let sellingPriceValue = sellingPriceProvided ? Number(values.price) : mrpValue;

    if (!Number.isFinite(sellingPriceValue) || sellingPriceValue <= 0) {
      sellingPriceValue = mrpValue;
    }

    if (Number.isFinite(mrpValue) && mrpValue > 0 && sellingPriceValue > mrpValue) {
      sellingPriceValue = mrpValue;
    }

    const selectedImageFile = typeof File !== 'undefined' && imageFile instanceof File ? imageFile : null;

    if (!editingProduct && !selectedImageFile) {
      throw new SubmissionError({
        image: 'Upload a product image before listing this product.',
        _error: 'Select an image to continue.',
      });
    }

    const formData = buildProductFormData(
      {
        name: values.name?.trim?.() ?? values.name,
        description: values.description?.trim?.() ?? values.description,
        category: normaliseCategoryValue(values.category),
        price: sellingPriceValue,
        mrp: Number.isFinite(mrpValue) && mrpValue > 0 ? mrpValue : sellingPriceValue,
        stock: Number(values.stock),
        status: values.status || 'available',
        isPublished: editingProduct ? Boolean(editingProduct.isPublished) : false,
      },
      selectedImageFile,
    );

    if (editingProduct) {
      await updateProduct({ id: editingProduct.id, body: formData }).unwrap();
      setNotice('Product updated successfully.');
    } else {
      await createProduct(formData).unwrap();
      setNotice('Product created successfully.');
    }

    setErrorNotice(null);
    dispatch(closeProductPanel());
    dispatch(reset('sellerProduct'));
    resetImageSelection();
    await fetchProductPage({ reset: true });
  });

  const closePanel = () => {
    dispatch(closeProductPanel());
    dispatch(reset('sellerProduct'));
    resetImageSelection();
  };

  const toggleProductSelection = (productId) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  };

  const toggleSelectAllFiltered = () => {
    setSelectedProductIds((current) => {
      if (allFilteredSelected) {
        return current.filter((productId) => !filteredProductIds.includes(productId));
      }

      const next = new Set(current);
      filteredProductIds.forEach((productId) => next.add(productId));
      return Array.from(next);
    });
  };

  const handleBulkPublishToggle = async (nextPublishedState) => {
    if (!selectedProducts.length) {
      return;
    }

    const confirmed = await confirm({
      title: `${nextPublishedState ? 'Publish' : 'Hide'} selected products`,
      message: `Apply this change to ${selectedProducts.length} selected product${selectedProducts.length === 1 ? '' : 's'}?`,
      confirmLabel: nextPublishedState ? 'Publish selected' : 'Hide selected',
      cancelLabel: 'Cancel',
      tone: nextPublishedState ? 'info' : 'warning',
    });

    if (!confirmed) {
      return;
    }

    await runProductBatchUpdate(
      selectedProducts,
      () => ({ isPublished: nextPublishedState }),
      nextPublishedState
        ? 'Selected products are now live.'
        : 'Selected products were moved out of the live catalogue.',
    );
  };

  const handleBulkStatusUpdate = async () => {
    if (!selectedProducts.length) {
      return;
    }

    await runProductBatchUpdate(
      selectedProducts,
      () => ({ status: bulkStatus }),
      `Selected products updated to ${formatStatus(bulkStatus)}.`,
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedProducts.length) {
      return;
    }

    const confirmed = await confirm({
      title: 'Delete selected products',
      message: `Delete ${selectedProducts.length} selected product${selectedProducts.length === 1 ? '' : 's'}? This cannot be undone.`,
      confirmLabel: 'Delete selected',
      cancelLabel: 'Keep products',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setNotice(null);
    setErrorNotice(null);
    setIsBulkUpdating(true);

    try {
      for (const product of selectedProducts) {
        await deleteProduct(product.id).unwrap();
      }
      setSelectedProductIds([]);
      setNotice('Selected products were removed from inventory.');
      await fetchProductPage({ reset: true });
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to delete all selected products.');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const refreshProducts = useCallback(async () => {
    await fetchProductPage({ reset: true });
  }, [fetchProductPage]);

  const handleLoadMoreProducts = useCallback(async () => {
    if (!productPagination.hasMore || !productPagination.nextCursor || isLoadingMore) {
      return;
    }

    await fetchProductPage({ cursor: productPagination.nextCursor }).catch(() => {});
  }, [fetchProductPage, isLoadingMore, productPagination.hasMore, productPagination.nextCursor]);

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        <DashboardSection title="Inventory">
          <SkeletonPanel lines={10} />
        </DashboardSection>
      </div>
    );
  }

  if (approvalError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Inventory"
          action={(
            <button type="button" onClick={() => refreshProducts()}>
              Refresh
            </button>
          )}
        >
          <EmptyState message={approvalMessage} />
        </DashboardSection>
      </div>
    );
  }

  if (productsError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Inventory unavailable"
          action={(
            <button type="button" onClick={() => refreshProducts()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load your product catalogue." />
        </DashboardSection>
      </div>
    );
  }

  const totalInventoryValue = filteredProducts.reduce((sum, product) => {
    const { price } = derivePricingDetails(product);
    return sum + (price || 0) * (Number(product.stock) || 0);
  }, 0);

  const lowStockProducts = filteredProducts.filter((product) => {
    const stock = Number(product.stock) || 0;
    return stock > 0 && stock <= LOW_STOCK_THRESHOLD;
  });

  const hiddenProducts = filteredProducts.filter((product) => !product.isPublished);
  const liveProducts = filteredProducts.filter((product) => product.isPublished);
  const recentSalesUnits = filteredProducts.reduce(
    (sum, product) => sum + (Number(product?.stats?.soldLast30Days) || 0),
    0,
  );

  const categoryPerformance = filteredProducts.reduce((accumulator, product) => {
    const key = product.category ? formatStatus(product.category) : 'Uncategorised';
    const stock = Number(product.stock) || 0;
    const { price } = derivePricingDetails(product);
    const totalSold = Number(product?.stats?.totalSold) || 0;
    const soldLast30Days = Number(product?.stats?.soldLast30Days) || 0;

    if (!accumulator[key]) {
      accumulator[key] = {
        category: key,
        products: 0,
        live: 0,
        hidden: 0,
        lowStock: 0,
        stockUnits: 0,
        totalSold: 0,
        soldLast30Days: 0,
        inventoryValue: 0,
      };
    }

    accumulator[key].products += 1;
    accumulator[key].live += product.isPublished ? 1 : 0;
    accumulator[key].hidden += product.isPublished ? 0 : 1;
    accumulator[key].lowStock += stock > 0 && stock <= LOW_STOCK_THRESHOLD ? 1 : 0;
    accumulator[key].stockUnits += stock;
    accumulator[key].totalSold += totalSold;
    accumulator[key].soldLast30Days += soldLast30Days;
    accumulator[key].inventoryValue += (price || 0) * stock;

    return accumulator;
  }, {});

  const categoryRows = Object.values(categoryPerformance).sort((left, right) => {
    if (right.inventoryValue !== left.inventoryValue) {
      return right.inventoryValue - left.inventoryValue;
    }
    return right.products - left.products;
  });

  return (
    <div className="dashboard-grid">
      <DashboardSection
        title="Inventory"
        action={(
          <button type="button" onClick={openCreatePanel}>
            Add product
          </button>
        )}
      >
        <div className="filter-chip-row">
          {filters.map((filter) => {
            const isActive = filter.key === filterStatus;
            return (
              <button
                key={filter.key}
                type="button"
                className={`filter-chip${isActive ? ' filter-chip--active' : ''}`}
                onClick={() => dispatch(setFilterStatus(filter.key))}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="inventory-toolbar">
          <SearchSuggestInput
            id="seller-inventory-search"
            value={searchText}
            onChange={setSearchText}
            onSelect={(suggestion) => setSearchText(suggestion.label)}
            suggestions={searchSuggestions}
            placeholder="Search by product name or category"
            ariaLabel="Search products"
            noResultsText="No products match those search attributes."
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="inventory-toolbar__input inventory-toolbar__input--select"
          >
            <option value="">All categories</option>
            {categoryFilterOptions.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Min selling price"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="inventory-toolbar__input inventory-toolbar__input--number"
          />
          <input
            type="number"
            placeholder="Max selling price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="inventory-toolbar__input inventory-toolbar__input--number"
          />
          <input
            type="number"
            placeholder="Min stock"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            className="inventory-toolbar__input inventory-toolbar__input--number"
          />
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <small>Products shown</small>
            <strong>{formatNumber(filteredProducts.length)}</strong>
            <small>{formatNumber(products.length)} total</small>
          </div>
            <div className="stat-card">
              <small>Live listings</small>
              <strong>{formatNumber(liveProducts.length)}</strong>
              <small>{formatNumber(hiddenProducts.length)} hidden in this view</small>
            </div>
            <div className="stat-card">
              <small>Low-stock warnings</small>
              <strong>{formatNumber(lowStockProducts.length)}</strong>
              <small>{`At or below ${LOW_STOCK_THRESHOLD} units`}</small>
            </div>
            <div className="stat-card">
              <small>Units sold recently</small>
              <strong>{formatNumber(recentSalesUnits)}</strong>
              <small>Across the current filtered view</small>
            </div>
          <div className="stat-card">
            <small>Inventory value</small>
            <strong>{formatCurrency(totalInventoryValue)}</strong>
            <small>Assuming listed price for the filtered set</small>
          </div>
        </div>

        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {filteredProducts.length ? (
          <div className="inventory-bulk-bar">
            <label className="selection-toggle">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAllFiltered}
                disabled={isBulkUpdating}
              />
              <span>Select shown products</span>
            </label>
            <span className="inventory-bulk-bar__count">{formatNumber(selectedProducts.length)} selected</span>
            <div className="inventory-bulk-bar__actions">
              <button type="button" onClick={() => handleBulkPublishToggle(true)} disabled={!selectedProducts.length || isBulkUpdating}>
                Publish
              </button>
              <button type="button" onClick={() => handleBulkPublishToggle(false)} disabled={!selectedProducts.length || isBulkUpdating}>
                Hide
              </button>
              <select
                className="inventory-toolbar__input inventory-toolbar__input--select"
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value)}
                disabled={!selectedProducts.length || isBulkUpdating}
              >
                <option value="available">Available</option>
                <option value="out-of-stock">Out of stock</option>
                <option value="discontinued">Discontinued</option>
              </select>
              <button type="button" onClick={handleBulkStatusUpdate} disabled={!selectedProducts.length || isBulkUpdating}>
                Apply status
              </button>
              <button type="button" onClick={handleBulkDelete} disabled={!selectedProducts.length || isBulkUpdating}>
                Delete selected
              </button>
            </div>
          </div>
        ) : null}

        {filteredProducts.length ? (
          <>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      disabled={isBulkUpdating}
                      aria-label="Select all shown products"
                    />
                  </th>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Stock</th>
                  <th>Price</th>
                  <th>Sales</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const pricing = derivePricingDetails(product);
                  const categoryLabel = product.category ? formatStatus(product.category) : 'Uncategorised';
                  const totalSold = Number(product?.stats?.totalSold ?? 0);
                  const soldLast30Days = Number(product?.stats?.soldLast30Days ?? 0);
                  const ratingCount = Number(product?.reviews?.count ?? 0);
                  const averageRating = Number(product?.reviews?.averageRating ?? 0);
                  return (
                    <tr key={product.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          disabled={isBulkUpdating}
                          aria-label={`Select ${product.name}`}
                        />
                      </td>
                      <td>
                        <strong>
                          <Link to={`/dashboard/seller/products/${product.id}`}>
                            {product.name}
                          </Link>
                        </strong>
                        <div className="dashboard-table__meta">
                          <span className="inventory-category">{categoryLabel}</span>
                          <small>{formatNumber(totalSold)} sold lifetime</small>
                          <small>
                            {ratingCount
                              ? `${averageRating.toFixed(1)} / 5 from ${formatNumber(ratingCount)} review${ratingCount === 1 ? '' : 's'}`
                              : 'No reviews yet'}
                          </small>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${product.isPublished ? 'status-pill--success' : 'status-pill--info'}`}>
                          {product.isPublished ? 'Published' : 'Draft'} - {formatStatus(product.status)}
                        </span>
                      </td>
                      <td>{formatNumber(product.stock ?? 0)}</td>
                      <td>
                        <div className="inventory-price">
                          {pricing.hasDiscount ? (
                            <>
                              <span className="inventory-price__mrp">{formatCurrency(pricing.mrp)}</span>
                              <span className="inventory-price__final">{formatCurrency(pricing.price)}</span>
                              <span className="inventory-price__badge">-{pricing.discountPercentage}%</span>
                            </>
                          ) : (
                            <span className="inventory-price__final">{formatCurrency(pricing.price)}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong>{formatNumber(soldLast30Days)}</strong>
                        <div className="dashboard-table__meta">
                          <small>Last 30 days</small>
                        </div>
                      </td>
                      <td>{formatDate(product.updatedAt)}</td>
                      <td>
                        <div className="button-row">
                          <Link to={`/dashboard/seller/products/${product.id}`}>
                            View
                          </Link>
                          <button type="button" onClick={() => openEditPanel(product)}>
                            Edit
                          </button>
                          <button type="button" onClick={() => handleTogglePublish(product)}>
                            {product.isPublished ? 'Disable' : 'Enable'}
                          </button>
                          <button type="button" onClick={() => handleDelete(product)} disabled={isDeleting || isBulkUpdating}>
                            {isDeleting ? 'Removing...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {productPagination.hasMore ? (
              <div className="inventory-load-more">
                <button type="button" onClick={handleLoadMoreProducts} disabled={isLoadingMore}>
                  {isLoadingMore ? 'Loading more...' : 'Load more products'}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState message="No products match the current filter." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Category performance"
        action={<span className="dashboard-timeframe-label">Current filtered catalogue health</span>}
      >
        {categoryRows.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Products</th>
                <th>Live / Hidden</th>
                <th>Low stock</th>
                <th>Stock units</th>
                <th>Units sold</th>
                <th>Last 30 days</th>
                <th>Inventory value</th>
              </tr>
            </thead>
            <tbody>
              {categoryRows.map((row) => (
                <tr key={row.category}>
                  <td>
                    <strong>{row.category}</strong>
                  </td>
                  <td>{formatNumber(row.products)}</td>
                  <td>{`${formatNumber(row.live)} / ${formatNumber(row.hidden)}`}</td>
                  <td>{formatNumber(row.lowStock)}</td>
                  <td>{formatNumber(row.stockUnits)}</td>
                  <td>{formatNumber(row.totalSold)}</td>
                  <td>{formatNumber(row.soldLast30Days)}</td>
                  <td>{formatCurrency(row.inventoryValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Category performance will appear once products match the current filters." />
        )}
      </DashboardSection>

      {isProductPanelOpen ? (
        <DashboardSection title={editingProduct ? 'Edit product' : 'Add product'}>
          <SellerProductForm
            onSubmit={submitProduct}
            onCancel={closePanel}
            isEditing={Boolean(editingProduct)}
            initialValues={mapInitialValues(editingProduct)}
            onImageSelect={handleImageSelect}
            selectedFile={imageFile}
            previewUrl={imagePreviewUrl}
            categoryOptions={productFormCategoryOptions}
          />
        </DashboardSection>
      ) : null}
      {confirmationModal}
    </div>
  );
};

export default InventoryPage;
