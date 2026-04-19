import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../app/hooks.js';
import { cartActions } from '../../features/cart/cartSlice.js';
import { useGetMarketplaceCatalogQuery } from '../../services/marketplaceApi.js';
import SearchSuggestInput from '../../components/dashboard/SearchSuggestInput.jsx';
import { matchesAcrossFields } from '../../utils/search.js';
import ProductFilters from './components/ProductFilters.jsx';
import ProductCard from './components/ProductCard.jsx';
import { saveBuyNowCheckoutItem } from './checkoutState.js';
import { readViewedMarketplaceProducts, trackViewedMarketplaceProduct } from './marketplaceStorage.js';
import './MarketplacePage.css';

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'priceLow', label: 'Price: Low to High' },
  { value: 'priceHigh', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest arrivals' },
];

const formatCategoryLabel = (value) => String(value ?? '')
  .split(/[\s-_]+/)
  .filter(Boolean)
  .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
  .join(' ');

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
  const [viewedProducts, setViewedProducts] = useState(() => readViewedMarketplaceProducts());

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }
    const timer = setTimeout(() => setFeedback(null), 2800);
    return () => clearTimeout(timer);
  }, [feedback]);

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

  const serverProducts = data?.data?.products ?? [];
  const pagination = data?.data?.pagination;

  const products = useMemo(() => {
    const typed = searchInput.trim();
    if (!typed) {
      return serverProducts;
    }
    return serverProducts.filter((product) =>
      matchesAcrossFields(
        [product.name, product.category, product.seller?.name],
        typed,
      ));
  }, [serverProducts, searchInput]);

  const totalResults = pagination?.total ?? products.length;
  const totalPages = pagination?.totalPages ?? 1;
  const showingUpperBound = Math.min(page * PAGE_SIZE, totalResults);
  const showingLowerBound = totalResults === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const isEmptyState = !isLoading && !isFetching && !products.length && !isError;

  const [productPool, setProductPool] = useState([]);
  useEffect(() => {
    if (!products.length) {
      return;
    }
    setProductPool((prev) => {
      const existing = new Set(prev.map((product) => product.id));
      const next = [...prev];
      products.forEach((product) => {
        if (product.id && !existing.has(product.id)) {
          next.push(product);
        }
      });
      return next;
    });
  }, [products]);

  const searchSuggestions = useMemo(() => {
    const suggestions = [];
    const seen = new Set();

    productPool.forEach((product) => {
      [
        {
          value: product.name,
          meta: `${product.category ?? 'Product'} | ${product.seller?.name ?? 'Unknown seller'}`,
        },
        {
          value: product.category,
          meta: `Category | ${product.name ?? 'Unnamed product'}`,
        },
        {
          value: product.seller?.name,
          meta: `Seller | ${product.name ?? 'Unnamed product'}`,
        },
      ].forEach((entry, index) => {
        const normalized = entry.value?.toString().trim();
        if (!normalized) {
          return;
        }

        const key = `${index}:${normalized.toLowerCase()}`;
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
  }, [productPool]);

  const categoryOptions = useMemo(() => {
    const responseCategories = Array.isArray(data?.data?.categories)
      ? data.data.categories
      : [];

    const liveCategories = responseCategories.length
      ? responseCategories
      : Array.from(
          new Set(
            productPool
              .map((product) => product?.category?.toString().trim().toLowerCase())
              .filter(Boolean),
          ),
        ).map((value) => ({ value }));

    return [
      { value: 'all', label: 'All categories' },
      ...liveCategories.map((entry) => ({
        value: entry.value,
        label: entry.label ?? formatCategoryLabel(entry.value),
      })),
    ];
  }, [data?.data?.categories, productPool]);

  const catalogueSummary = useMemo(() => {
    const inStockCount = serverProducts.filter((product) => product?.stats?.inStock !== false).length;
    const sellerCount = new Set(serverProducts.map((product) => product?.seller?.id).filter(Boolean)).size;
    return {
      inStockCount,
      sellerCount,
      categoryCount: Math.max(categoryOptions.length - 1, 0),
    };
  }, [categoryOptions.length, serverProducts]);

  const featuredCollections = useMemo(() => {
    const grouped = productPool.reduce((acc, product) => {
      const category = product?.category ?? 'other';
      const current = acc.get(category) ?? {
        category,
        count: 0,
        totalRating: 0,
        totalDiscount: 0,
        sellerIds: new Set(),
        leader: null,
      };

      current.count += 1;
      current.totalRating += Number(product?.reviews?.averageRating ?? 0);
      current.totalDiscount += Number(product?.discountPercentage ?? 0);
      if (product?.seller?.id) {
        current.sellerIds.add(product.seller.id);
      }
      if (!current.leader || Number(product?.reviews?.count ?? 0) > Number(current.leader?.reviews?.count ?? 0)) {
        current.leader = product;
      }

      acc.set(category, current);
      return acc;
    }, new Map());

    return [...grouped.values()]
      .map((entry) => ({
        category: entry.category,
        label: formatCategoryLabel(entry.category),
        count: entry.count,
        sellerCount: entry.sellerIds.size,
        avgRating: entry.count ? (entry.totalRating / entry.count).toFixed(1) : '0.0',
        avgDiscount: entry.count ? Math.round(entry.totalDiscount / entry.count) : 0,
        leader: entry.leader,
      }))
      .sort((left, right) => (
        Number(right.avgRating) - Number(left.avgRating)
        || right.count - left.count
      ))
      .slice(0, 3);
  }, [productPool]);

  const viewedRecommendations = useMemo(() => {
    if (!viewedProducts.length) {
      return [];
    }

    const pool = productPool.length ? productPool : serverProducts;
    const productMap = new Map(pool.map((product) => [String(product.id), product]));
    return viewedProducts
      .map((entry) => productMap.get(String(entry.id)))
      .filter(Boolean)
      .slice(0, 4);
  }, [productPool, serverProducts, viewedProducts]);

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

  const handleSearchSubmit = useCallback((event) => {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  }, [searchInput]);

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
    const checkoutItem = saveBuyNowCheckoutItem({
      id: product?.id,
      name: product?.name,
      price: product?.price,
      image: product?.image,
      seller: product?.seller ?? null,
      quantity: 1,
    });

    if (!checkoutItem) {
      return;
    }

    navigate('/checkout?mode=buy-now', {
      state: {
        checkoutMode: 'buy-now',
        checkoutItem,
      },
    });
  }, [navigate]);

  const handleViewDetails = useCallback((product) => {
    if (!product?.id) {
      return;
    }
    setViewedProducts(trackViewedMarketplaceProduct(product));
    navigate(`/marketplace/products/${product.id}`);
  }, [navigate]);

  return (
    <div className="marketplace-page">
      <header className="marketplace-hero">
        <div className="marketplace-hero__intro">
          <p className="eyebrow">FitSync marketplace</p>
          <h1>Equipment, supplements, and essentials with real seller context.</h1>
          <p className="marketplace-hero__copy">
            Browse live stock, seller summaries, estimated delivery windows, and return support before you place an order.
          </p>
        </div>
        <div className="marketplace-hero__stats">
          <div>
            <small>Results</small>
            <strong>{totalResults}</strong>
          </div>
          <div>
            <small>In stock</small>
            <strong>{catalogueSummary.inStockCount}</strong>
          </div>
          <div>
            <small>Sellers</small>
            <strong>{catalogueSummary.sellerCount}</strong>
          </div>
          <div>
            <small>Categories</small>
            <strong>{catalogueSummary.categoryCount}</strong>
          </div>
        </div>

        <form className="marketplace-search-simple" onSubmit={handleSearchSubmit}>
          <SearchSuggestInput
            id="marketplace-search"
            placeholder="Search for protein, straps, or sellers"
            value={searchInput}
            onChange={setSearchInput}
            onSelect={(suggestion) => {
              setSearchInput(suggestion.label);
              setSearchQuery(suggestion.label.trim());
            }}
            suggestions={searchSuggestions}
            aria-label="Search marketplace catalogue"
            noResultsText="No products match those search attributes."
            className="marketplace-search-simple__field"
            inputClassName="marketplace-search-simple__input"
          />
          <button type="submit">Search</button>
        </form>

        <div className="marketplace-hero__policies">
          <span>Estimated delivery: 3-5 business days</span>
          <span>Track every item after checkout</span>
          <span>Returns reviewed after delivery confirmation</span>
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
          categoryOptions={categoryOptions}
          onChange={updateFilters}
          onReset={handleResetFilters}
          onPricePreset={handlePricePreset}
          disabled={isLoading && !products.length}
        />

        <section className="marketplace-results">
          {featuredCollections.length ? (
            <section className="marketplace-merchandising">
              <div className="marketplace-section-header">
                <div>
                  <h2>Featured collections</h2>
                  <p>Browse the strongest live categories based on rating, catalogue depth, and seller variety.</p>
                </div>
              </div>
              <div className="marketplace-collections">
                {featuredCollections.map((collection) => (
                  <button
                    key={collection.category}
                    type="button"
                    className="marketplace-collection-card"
                    onClick={() => {
                      updateFilters({ category: collection.category, sort: 'featured' });
                      setSearchInput('');
                      setSearchQuery('');
                      setPage(1);
                    }}
                  >
                    <small>{collection.label}</small>
                    <strong>{collection.count} live products</strong>
                    <p>
                      Avg rating {collection.avgRating} · {collection.sellerCount} seller{collection.sellerCount === 1 ? '' : 's'}
                    </p>
                    <span>
                      {collection.avgDiscount > 0
                        ? `Average discount ${collection.avgDiscount}%`
                        : `Led by ${collection.leader?.name ?? 'top products'}`}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {viewedRecommendations.length ? (
            <section className="marketplace-merchandising">
              <div className="marketplace-section-header">
                <div>
                  <h2>Because you viewed</h2>
                  <p>Jump back into recently viewed products without rebuilding your search.</p>
                </div>
              </div>
              <div className="product-grid product-grid--compact">
                {viewedRecommendations.map((product) => (
                  <ProductCard
                    key={`viewed-${product.id}`}
                    product={product}
                    onAddToCart={handleAddToCart}
                    onBuyNow={handleBuyNow}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            </section>
          ) : null}

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
