import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../app/hooks.js';
import { cartActions } from '../../features/cart/cartSlice.js';
import { useGetMarketplaceProductQuery } from '../../services/marketplaceApi.js';
import { formatCurrency, formatDate, formatNumber } from '../../utils/format.js';
import { deriveProductPricing, formatRatingLabel, formatSoldCopy } from './utils.js';
import './MarketplaceProductPage.css';

const MarketplaceProductPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [feedback, setFeedback] = useState(null);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetMarketplaceProductQuery(productId, {
    skip: !productId,
  });

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }
    const timer = setTimeout(() => setFeedback(null), 2800);
    return () => clearTimeout(timer);
  }, [feedback]);

  const product = data?.data?.product ?? null;
  const pricing = useMemo(() => deriveProductPricing(product ?? {}), [product]);
  const ratingValue = Number(product?.reviews?.averageRating ?? 0);
  const ratingPercent = Math.min(100, Math.max(0, (ratingValue / 5) * 100));
  const reviewCount = Number(product?.reviews?.count ?? 0);
  const reviewItems = product?.reviews?.items ?? [];
  const soldCopy = formatSoldCopy(product?.stats?.soldLast30Days ?? 0);
  const inStock = product?.stats?.inStock !== false;
  const totalSold = Number(product?.stats?.totalSold ?? 0);

  const addProductToCart = () => {
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
  };

  const handleBuyNow = () => {
    if (!product?.id) {
      return;
    }
    addProductToCart();
    navigate('/checkout');
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/marketplace');
  };

  if (isLoading || (isFetching && !product)) {
    return (
      <div className="product-detail-page">
        <div className="product-detail__state" role="status">
          Loading product details…
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="product-detail-page">
        <div className="product-detail__state product-detail__state--error">
          <p>We could not load this product right now.</p>
          <button type="button" onClick={() => refetch()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-page">
        <div className="product-detail__state">
          <p>The product is unavailable or no longer published.</p>
          <button type="button" onClick={() => navigate('/marketplace')}>Browse marketplace</button>
        </div>
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      <button type="button" className="product-detail__back" onClick={handleBack}>
        ← Back to marketplace
      </button>

      {feedback ? (
        <div className="product-detail__feedback" role="status">
          {feedback}
        </div>
      ) : null}

      <section className="product-detail__grid">
        <div className="product-detail__media">
          {product.image ? (
            <img src={product.image} alt={product.name} />
          ) : (
            <div className="product-detail__placeholder">
              {(product.name ?? '?').slice(0, 1)}
            </div>
          )}
        </div>

        <div className="product-detail__content">
          <p className="eyebrow">FitSync marketplace</p>
          <h1>{product.name}</h1>
          <p className="product-detail__description">{product.description}</p>

          <div className="product-detail__rating">
            <div className="product-card__stars" style={{ '--rating-fill': `${ratingPercent}%` }} aria-hidden>
              <span className="product-card__stars-base">★★★★★</span>
              <span className="product-card__stars-fill">★★★★★</span>
            </div>
            <span className="product-detail__rating-value">{formatRatingLabel(ratingValue)}</span>
            <span className="product-detail__review-count">
              {reviewCount ? `${formatNumber(reviewCount)} reviews` : 'No reviews yet'}
            </span>
          </div>

          <div className="product-detail__price-row">
            <div className="product-detail__price">
              <span className="product-card__price">{formatCurrency(pricing.price)}</span>
              {pricing.hasDiscount ? (
                <>
                  <span className="product-card__mrp">{formatCurrency(pricing.mrp)}</span>
                  <span className="product-card__discount">-{pricing.discountPercentage}%</span>
                </>
              ) : null}
            </div>
            <div className="product-detail__stock" data-in-stock={inStock}>
              {inStock ? 'In stock' : 'Out of stock'}
            </div>
          </div>

          <ul className="product-detail__highlights">
            <li>{soldCopy}</li>
            <li>{totalSold ? `${formatNumber(totalSold)} lifetime units sold` : 'Be the first to buy this item'}</li>
            <li>Category: <strong>{product.category ?? '—'}</strong></li>
          </ul>

          <div className="product-detail__actions">
            <button
              type="button"
              className="product-card__action product-card__action--primary"
              onClick={handleBuyNow}
              disabled={!inStock}
            >
              Buy now
            </button>
            <button
              type="button"
              className="product-card__action product-card__action--secondary"
              onClick={addProductToCart}
              disabled={!inStock}
            >
              Add to cart
            </button>
          </div>
        </div>

        <aside className="product-detail__meta">
          <h2>Seller</h2>
          {product.seller ? (
            <>
              <p className="product-detail__seller-name">{product.seller.name}</p>
              {product.seller.role ? <p className="product-detail__seller-role">{product.seller.role}</p> : null}
            </>
          ) : (
            <p>FitSync inventory partner</p>
          )}
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{inStock ? 'Available to ship' : 'Restocking soon'}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDate(product.updatedAt)}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="product-detail__section">
        <h2>Product details</h2>
        <dl className="product-detail__facts">
          <div>
            <dt>Price</dt>
            <dd>{formatCurrency(product.price)}</dd>
          </div>
          <div>
            <dt>MRP</dt>
            <dd>{formatCurrency(product.mrp)}</dd>
          </div>
          <div>
            <dt>Stock</dt>
            <dd>{product.stock ? `${product.stock} units` : 'Not available'}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{product.category ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="product-detail__section">
        <div className="product-detail__reviews-header">
          <h2>Customer reviews</h2>
          <span>{formatRatingLabel(ratingValue)} • {reviewCount ? `${formatNumber(reviewCount)} ratings` : 'New product'}</span>
        </div>
        {reviewItems.length ? (
          <div className="product-detail__reviews">
            {reviewItems.map((review) => (
              <article key={review.id} className="product-review">
                <div className="product-review__header">
                  <div>
                    <p className="product-review__author">{review.user?.name ?? 'FitSync member'}</p>
                    <p className="product-review__meta">
                      {formatDate(review.createdAt)} • {review.isVerifiedPurchase ? 'Verified purchase' : 'Community review'}
                    </p>
                  </div>
                  <span className="product-review__rating">{review.rating}/5</span>
                </div>
                {review.title ? <h3>{review.title}</h3> : null}
                <p>{review.comment || 'No comment provided.'}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="product-detail__state">No reviews yet. Be the first to share your experience.</p>
        )}
      </section>
    </div>
  );
};

export default MarketplaceProductPage;
