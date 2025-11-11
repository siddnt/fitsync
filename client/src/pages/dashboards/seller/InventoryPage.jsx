import { useMemo, useState, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import SellerProductForm from './SellerProductForm.jsx';
import { SubmissionError } from 'redux-form';
import { createSubmissionHandler, normaliseCategoryValue, categoryOptions } from './helpers.js';
import {
  useGetSellerProductsQuery,
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
import '../Dashboard.css';

const filters = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
  { key: 'available', label: 'Available' },
  { key: 'out-of-stock', label: 'Out of stock' },
];

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

  const {
    data: productsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetSellerProductsQuery();
  const [createProduct] = useCreateSellerProductMutation();
  const [updateProduct] = useUpdateSellerProductMutation();
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteSellerProductMutation();

  const rawProducts = productsResponse?.data?.products;

  const products = useMemo(
    () => (Array.isArray(rawProducts) ? rawProducts : []),
    [rawProducts],
  );

  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingProductId) ?? null,
    [products, editingProductId],
  );

  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minStock, setMinStock] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

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

    // search by name
    if (searchText.trim()) {
      const t = searchText.trim().toLowerCase();
      list = list.filter((p) => (p.name || '').toLowerCase().includes(t));
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

  const approvalError = error?.status === 403 ? error : null;
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
    const confirmed = window.confirm(`Remove ${product.name}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteProduct(product.id).unwrap();
      setNotice('Product removed from inventory.');
      refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to delete this product.');
    }
  };

  const handleTogglePublish = async (product) => {
    if (!product) return;
    setNotice(null);
    setErrorNotice(null);

    try {
      const pricing = derivePricingDetails(product);
      const formData = buildProductFormData(
        {
          name: product.name,
          description: product.description ?? '',
          category: normaliseCategoryValue(product.category),
          price: pricing.price,
          mrp: pricing.mrp,
          stock: product.stock ?? 0,
          status: product.status || 'available',
          isPublished: !product.isPublished,
        },
      );

      await updateProduct({ id: product.id, body: formData }).unwrap();
      setNotice(product.isPublished ? 'Product unpublished.' : 'Product published.');
      refetch();
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
    refetch();
  });

  const closePanel = () => {
    dispatch(closeProductPanel());
    dispatch(reset('sellerProduct'));
    resetImageSelection();
  };

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
            <button type="button" onClick={() => refetch()}>
              Refresh
            </button>
          )}
        >
          <EmptyState message={approvalMessage} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Inventory unavailable"
          action={(
            <button type="button" onClick={() => refetch()}>
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
          <input
            type="text"
            placeholder="Search by name"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="inventory-toolbar__input"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="inventory-toolbar__input inventory-toolbar__input--select"
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
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
            <small>Published listings</small>
            <strong>{formatNumber(filteredProducts.filter((product) => product.isPublished).length)}</strong>
            <small>Current filter</small>
          </div>
          <div className="stat-card">
            <small>Inventory value</small>
            <strong>{formatCurrency(totalInventoryValue)}</strong>
            <small>Assuming listed price · Filtered set</small>
          </div>
        </div>

        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {filteredProducts.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>Stock</th>
                <th>Price</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const pricing = derivePricingDetails(product);
                const categoryLabel = product.category ? formatStatus(product.category) : 'Uncategorised';
                return (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <div className="dashboard-table__meta">
                        <span className="inventory-category">{categoryLabel}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${product.isPublished ? 'status-pill--success' : 'status-pill--info'}`}>
                        {product.isPublished ? 'Published' : 'Draft'} · {formatStatus(product.status)}
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
                    <td>{formatDate(product.updatedAt)}</td>
                    <td>
                      <div className="button-row">
                        <button type="button" onClick={() => openEditPanel(product)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => handleTogglePublish(product)}>
                          {product.isPublished ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" onClick={() => handleDelete(product)} disabled={isDeleting}>
                          {isDeleting ? 'Removing…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No products match the current filter." />
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
          />
        </DashboardSection>
      ) : null}
    </div>
  );
};

export default InventoryPage;
