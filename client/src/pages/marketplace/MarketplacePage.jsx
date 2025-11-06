import { useCallback, useEffect, useMemo, useState } from 'react';
import './MarketplacePage.css';
import { useGetMarketplaceCatalogQuery } from '../../services/marketplaceApi.js';
import { formatCurrency } from '../../utils/format.js';
import { useAppDispatch } from '../../app/hooks.js';
import { cartActions } from '../../features/cart/cartSlice.js';
import { useNavigate } from 'react-router-dom';

const MarketplacePage = () => {
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useGetMarketplaceCatalogQuery();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState(null);

  const products = useMemo(
    () => (Array.isArray(data?.data?.products) ? data.data.products : []),
    [data],
  );

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timer = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const addProductToCart = useCallback((product) => {
    if (!product?.id) {
      return;
    }

    const productName = product.name ?? 'Product';

    dispatch(cartActions.addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      seller: product.seller ?? null,
      quantity: 1,
    }));
    setFeedback(`${productName} added to your cart.`);
  }, [dispatch]);

  const handleAddToCart = useCallback((product) => {
    addProductToCart(product);
  }, [addProductToCart]);

  const handleBuyNow = useCallback((product) => {
    addProductToCart(product);
    navigate('/checkout');
  }, [addProductToCart, navigate]);

  return (
    <div className="marketplace-page">
      <header>
        <h1>Marketplace</h1>
        <p>Discover curated fitness products from verified sellers.</p>
      </header>

      {feedback ? (
        <div className="marketplace-feedback" role="status">
          {feedback}
        </div>
      ) : null}

      <section className="marketplace-section">
        <div className="marketplace-section__header">
          <h2>Featured products</h2>
          {isError ? (
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          ) : null}
        </div>

        {isLoading ? (
          <p className="marketplace-state">Loading products…</p>
        ) : null}

        {!isLoading && isError ? (
          <p className="marketplace-state marketplace-state--error">
            We could not load the marketplace catalogue right now.
          </p>
        ) : null}

        {!isLoading && !isError && !products.length ? (
          <p className="marketplace-state">No products are available yet. Check back soon.</p>
        ) : null}

        {!isLoading && !isError && products.length ? (
          <div className="marketplace-grid marketplace-grid--products">
            {products.map((product) => (
              <article key={product.id} className="marketplace-product">
                <div className="marketplace-product__media">
                  {product.image ? (
                    <img src={product.image} alt={product.name} loading="lazy" />
                  ) : (
                    <div className="marketplace-product__placeholder" aria-hidden>
                      {(product.name ?? '?').slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="marketplace-product__content">
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="marketplace-product__meta">
                    <span>{formatCurrency(product.price)}</span>
                    {product.seller?.name ? (
                      <span className="marketplace-product__seller">By {product.seller.name}</span>
                    ) : null}
                  </div>
                  <div className="marketplace-product__actions">
                    <button
                      type="button"
                      className="marketplace-product__button marketplace-product__button--primary"
                      onClick={() => handleBuyNow(product)}
                    >
                      Buy now
                    </button>
                    <button
                      type="button"
                      className="marketplace-product__button marketplace-product__button--secondary"
                      onClick={() => handleAddToCart(product)}
                    >
                      Add to cart
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default MarketplacePage;
