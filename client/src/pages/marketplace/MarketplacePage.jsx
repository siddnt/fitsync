import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../app/hooks.js';
import { cartActions } from '../../features/cart/cartSlice.js';
import { useGetMarketplaceCatalogQuery } from '../../services/marketplaceApi.js';
import ProductFilters from './components/ProductFilters.jsx';
import ProductCard from './components/ProductCard.jsx';
import './MarketplacePage.css';

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'priceLow', label: 'Price: Low to High' },
  { value: 'priceHigh', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest arrivals' },
];

const MarketplacePage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState(null);
  const [filters, setFilters] = useState({
    category: 'all',
    minPrice: '',
    maxPrice: '',
    inStockOnly: false,
    sort: 'featured',
  });
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }
    const timer = setTimeout(() => setFeedback(null), 2800);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [filters.category, filters.minPrice, filters.maxPrice, filters.inStockOnly, filters.sort, searchQuery]);

  const queryParams = useMemo(() => {
    const params = {
      page,
      pageSize: PAGE_SIZE,
      sort: filters.sort,
    };

    if (searchQuery) {
      params.search = searchQuery;
    }

    if (filters.category && filters.category !== 'all') {
      params.category = filters.category;
    }

    const hasMinPrice = filters.minPrice !== '' && filters.minPrice !== null && filters.minPrice !== undefined;
    if (hasMinPrice) {
      const minPriceValue = Number(filters.minPrice);
      if (Number.isFinite(minPriceValue) && minPriceValue >= 0) {
        params.minPrice = minPriceValue;
      }
    }

    const hasMaxPrice = filters.maxPrice !== '' && filters.maxPrice !== null && filters.maxPrice !== undefined;
    if (hasMaxPrice) {
      const maxPriceValue = Number(filters.maxPrice);
      if (Number.isFinite(maxPriceValue) && maxPriceValue >= 0) {
        params.maxPrice = maxPriceValue;
      }
    }

    if (filters.inStockOnly) {
      params.inStock = true;
    }

    return params;
  }, [filters, page, searchQuery]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetMarketplaceCatalogQuery(queryParams);

  const products = data?.data?.products ?? [];
  const pagination = data?.data?.pagination;
  const totalResults = pagination?.total ?? products.length;
  const totalPages = pagination?.totalPages ?? 1;
  const showingUpperBound = Math.min(page * PAGE_SIZE, totalResults);
  const showingLowerBound = totalResults === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const isEmptyState = !isLoading && !isFetching && !products.length && !isError;

  const updateFilters = (partial) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  };

  const handlePricePreset = (min, max) => {
    updateFilters({
      minPrice: Number.isFinite(min) ? String(min) : '',
      maxPrice: Number.isFinite(max) ? String(max) : '',
    });
  };

  const handleResetFilters = () => {
    setFilters({ category: 'all', minPrice: '', maxPrice: '', inStockOnly: false, sort: 'featured' });
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  };

  const addProductToCart = useCallback((product) => {
    if (!product?.id) {
      return;
    }
    dispatch(cartActions.addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      seller: product.seller ?? null,
      quantity: 1,
    }));
    setFeedback(`${product.name ?? 'Product'} added to your cart.`);
  }, [dispatch]);

  const handleAddToCart = useCallback((product) => {
    addProductToCart(product);
  }, [addProductToCart]);

  const handleBuyNow = useCallback((product) => {
    addProductToCart(product);
    navigate('/checkout');
  }, [addProductToCart, navigate]);

  const handleViewDetails = useCallback((product) => {
    if (!product?.id) {
      return;
    }
    navigate(`/marketplace/products/${product.id}`);
  }, [navigate]);

  return (
    <div className="marketplace-page">
      <header className="marketplace-hero">
        <div>
          <p className="eyebrow">FitSync marketplace</p>
          <h1>Everything you need for the gym bag</h1>
          <p>Shop curated supplements, gear, and accessories vetted by our coaching team.</p>
        </div>
        <div className="marketplace-search">
          <input
            type="search"
            placeholder="Search for protein, straps, or sellers"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search marketplace catalogue"
          />
          <span className="marketplace-search__hint">{ isFetching && !isLoading ? 'Updating results…' : 'Press Enter to search faster' }</span>
        </div>
      </header>

      {feedback ? (
        <div className="marketplace-feedback" role="status">
          {feedback}
        </div>
      ) : null}

      <div className="marketplace-layout">
        <ProductFilters
          filters={filters}
          onChange={updateFilters}
          onReset={handleResetFilters}
          onPricePreset={handlePricePreset}
          disabled={isLoading && !products.length}
        />

        <section className="marketplace-results">
          <div className="marketplace-results__header">
            <div>
              <h2>Results</h2>
              <p>
                {totalResults ? `Showing ${showingLowerBound}-${showingUpperBound} of ${totalResults} products`
                  : 'No products to show yet.'}
              </p>
            </div>
            <div className="marketplace-results__controls">
              <label htmlFor="marketplace-sort">Sort by</label>
              <select
                id="marketplace-sort"
                value={filters.sort}
                onChange={(event) => updateFilters({ sort: event.target.value })}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isError ? (
            <div className="marketplace-state marketplace-state--error">
              <p>We couldn&apos;t load the marketplace right now.</p>
              <button type="button" onClick={() => refetch()}>Retry</button>
            </div>
          ) : null}

          {isLoading && !products.length ? (
            <div className="product-grid product-grid--placeholder">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="product-card product-card--placeholder" />
              ))}
            </div>
          ) : null}

          {!isLoading && products.length ? (
            <>
              <div className="product-grid">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    onBuyNow={handleBuyNow}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
              {totalPages > 1 ? (
                <div className="marketplace-pagination">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {isEmptyState ? (
            <p className="marketplace-state">No products match the selected filters. Try adjusting the price or category.</p>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default MarketplacePage;
