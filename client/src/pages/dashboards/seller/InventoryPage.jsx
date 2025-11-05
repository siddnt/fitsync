import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import SellerProductForm from './SellerProductForm.jsx';
import { createSubmissionHandler, normaliseCategoryValue } from './helpers.js';
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

const mapInitialValues = (product) => {
  if (!product) {
    return {
      status: 'available',
      isPublished: true,
    };
  }

  return {
    id: product.id,
    name: product.name,
    description: product.description,
  category: normaliseCategoryValue(product.category),
    price: product.price,
    stock: product.stock,
  status: typeof product.status === 'string' ? product.status.toLowerCase() : 'available',
    isPublished: product.isPublished,
    image: product.image,
  };
};

const InventoryPage = () => {
  const dispatch = useDispatch();
  const { editingProductId, isProductPanelOpen, filterStatus } = useSelector((state) => state.seller);

  const {
    data: productsResponse,
    isLoading,
    isError,
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

  const filteredProducts = useMemo(() => {
    if (filterStatus === 'all') {
      return products;
    }

    if (filterStatus === 'published') {
      return products.filter((product) => product.isPublished);
    }

    if (filterStatus === 'draft') {
      return products.filter((product) => !product.isPublished);
    }

    return products.filter((product) => (product.status ?? '').toLowerCase() === filterStatus);
  }, [products, filterStatus]);

  const openCreatePanel = () => {
    setNotice(null);
    setErrorNotice(null);
    dispatch(openProductPanel(null));
    dispatch(reset('sellerProduct'));
  };

  const openEditPanel = (product) => {
    setNotice(null);
    setErrorNotice(null);
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

  const submitProduct = createSubmissionHandler(async (values) => {
    const payload = {
      name: values.name,
      description: values.description,
  category: normaliseCategoryValue(values.category),
      price: Number(values.price),
      stock: Number(values.stock),
      status: values.status || 'available',
      isPublished: Boolean(values.isPublished),
      image: values.image,
    };

    if (editingProduct) {
      await updateProduct({ id: editingProduct.id, ...payload }).unwrap();
      setNotice('Product updated successfully.');
    } else {
      await createProduct(payload).unwrap();
      setNotice('Product created successfully.');
    }

    setErrorNotice(null);
    dispatch(closeProductPanel());
    dispatch(reset('sellerProduct'));
    refetch();
  });

  const closePanel = () => {
    dispatch(closeProductPanel());
    dispatch(reset('sellerProduct'));
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

  const totalInventoryValue = filteredProducts.reduce(
    (sum, product) => sum + (Number(product.price) || 0) * (Number(product.stock) || 0),
    0,
  );

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
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    <div>
                      <small>{product.category}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill ${product.isPublished ? 'status-pill--success' : 'status-pill--info'}`}>
                      {product.isPublished ? 'Published' : 'Draft'} · {formatStatus(product.status)}
                    </span>
                  </td>
                  <td>{formatNumber(product.stock ?? 0)}</td>
                  <td>{formatCurrency(product.price)}</td>
                  <td>{formatDate(product.updatedAt)}</td>
                  <td>
                    <div className="button-row">
                      <button type="button" onClick={() => openEditPanel(product)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(product)} disabled={isDeleting}>
                        {isDeleting ? 'Removing…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
          />
        </DashboardSection>
      ) : null}
    </div>
  );
};

export default InventoryPage;
