import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../app/hooks.js';
import { cartActions } from '../../features/cart/cartSlice.js';
import {
  useGetMarketplaceCatalogQuery,
  useGetMarketplaceProductQuery,
} from '../../services/marketplaceApi.js';
import { formatCurrency, formatDate, formatNumber } from '../../utils/format.js';
import { deriveProductPricing, formatRatingLabel, formatSoldCopy } from './utils.js';
import ProductCard from './components/ProductCard.jsx';
import { saveBuyNowCheckoutItem } from './checkoutState.js';
import { trackViewedMarketplaceProduct } from './marketplaceStorage.js';
import './MarketplacePage.css';
import './MarketplaceProductPage.css';

const formatMetadataLabel = (value) => String(value ?? '')
  .split(/[\s-_]+/)
  .filter(Boolean)
  .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
  .join(' ');

const MarketplaceProductPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [feedback, setFeedback] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

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
  const {
    data: relatedResponse,
  } = useGetMarketplaceCatalogQuery(
    {
      category: product?.category,
      page: 1,
      pageSize: 5,
      sort: 'featured',
    },
    {
      skip: !product?.category,
    },
  );

  const pricing = useMemo(() => deriveProductPricing(product ?? {}), [product]);
  const ratingValue = Number(product?.reviews?.averageRating ?? 0);
  const ratingPercent = Math.min(100, Math.max(0, (ratingValue / 5) * 100));
  const reviewCount = Number(product?.reviews?.count ?? 0);
  const reviewItems = product?.reviews?.items ?? [];
  const soldCopy = formatSoldCopy(product?.stats?.soldLast30Days ?? 0);
  const inStock = product?.stats?.inStock !== false;
  const totalSold = Number(product?.stats?.totalSold ?? 0);
  const sellerSummary = product?.seller?.name ?? 'FitSync inventory partner';
  const sellerSecondary = [
    product?.seller?.role,
    product?.seller?.location,
  ]
    .filter(Boolean)
    .join(' | ');
  const relatedProducts = useMemo(
    () => (relatedResponse?.data?.products ?? []).filter((entry) => String(entry.id) !== String(product?.id)).slice(0, 4),
    [product?.id, relatedResponse?.data?.products],
  );
  const galleryImages = useMemo(() => {
    const metadataGallery = [
      product?.metadata?.gallery,
      product?.metadata?.galleryImages,
    ]
      .filter(Boolean)
      .flatMap((entry) => String(entry).split(',').map((item) => item.trim()).filter(Boolean));

    return [...new Set([product?.image, ...metadataGallery].filter(Boolean))];
  }, [product?.image, product?.metadata?.gallery, product?.metadata?.galleryImages]);
  const selectedImage = galleryImages[selectedImageIndex] ?? galleryImages[0] ?? null;
  const specEntries = useMemo(() => {
    const metadata = product?.metadata && typeof product.metadata === 'object'
      ? Object.entries(product.metadata)
      : [];

    return metadata
      .filter(([key, value]) => value && !['imageProvider', 'imagePublicId'].includes(String(key)))
      .map(([key, value]) => ({
        key,
        label: formatMetadataLabel(key),
        value: String(value),
      }));
  }, [product?.metadata]);

  useEffect(() => {
    if (product?.id) {
      trackViewedMarketplaceProduct(product);
    }
  }, [product]);

  useEffect(() => {
    setSelectedImageIndex(0);
    setIsZoomOpen(false);
  }, [product?.id]);

  const addProductToCart = () => {
    if (!product?.id) {
      return;
    }
    dispatch(cartActions.addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      mrp: product.mrp ?? product.price,
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

    const checkoutItem = saveBuyNowCheckoutItem({
      id: product.id,
      name: product.name,
      price: product.price,
      mrp: product.mrp ?? product.price,
      image: product.image,
      seller: product.seller ?? null,
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
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/marketplace');
  };

  const handleViewRelatedDetails = (item) => {
    if (!item?.id) {
      return;
    }
    navigate(`/marketplace/products/${item.id}`);
  };

  const handleBuyRelatedNow = (item) => {
    const checkoutItem = saveBuyNowCheckoutItem({
      id: item?.id,
      name: item?.name,
      price: item?.price,
      mrp: item?.mrp ?? item?.price,
      image: item?.image,
      seller: item?.seller ?? null,
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
  };

  const handleAddRelatedToCart = (item) => {
    if (!item?.id) {
      return;
    }
    dispatch(cartActions.addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      mrp: item.mrp ?? item.price,
      image: item.image,
      seller: item.seller ?? null,
      quantity: 1,
    }));
    setFeedback(`${item.name ?? 'Product'} added to your cart.`);
  };

  if (isLoading || (isFetching && !product)) {
    return (
      <div className="product-detail-page">
        <div className="product-detail__state" role="status">
          Loading product details...
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
        Back to marketplace
      </button>

      {feedback ? (
        <div className="product-detail__feedback" role="status">
          {feedback}
        </div>
      ) : null}

      <section className="product-detail__grid">
        <div className="product-detail__media">
          {selectedImage ? (
            <button
              type="button"
              className="product-detail__media-main"
              onClick={() => setIsZoomOpen(true)}
            >
              <img src={selectedImage} alt={product.name} loading="eager" decoding="async" />
              <span className="product-detail__zoom-hint">Click to zoom</span>
            </button>
          ) : (
            <div className="product-detail__placeholder">
              {(product.name ?? '?').slice(0, 1)}
            </div>
          )}
          {galleryImages.length ? (
            <div className="product-detail__media-strip">
              {galleryImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  className={`product-detail__thumbnail ${index === selectedImageIndex ? 'is-active' : ''}`}
                  onClick={() => setSelectedImageIndex(index)}
                >
                  <img src={image} alt={`${product.name} view ${index + 1}`} loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
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
            <li>Category: <strong>{product.category ?? 'Uncategorised'}</strong></li>
            <li>{inStock ? 'Estimated delivery in 3-5 business days' : 'Delivery resumes once stock is back'}</li>
            <li>Return support is handled from your orders dashboard after delivery.</li>
            {specEntries.length ? <li>{specEntries.length} published product specifications available below.</li> : null}
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
          <h2>Seller summary</h2>
          <div className="product-detail__seller-card">
            {product?.seller?.avatar ? (
              <img
                src={product.seller.avatar}
                alt={sellerSummary}
                className="product-detail__seller-avatar"
              />
            ) : (
              <div className="product-detail__seller-avatar product-detail__seller-avatar--placeholder" aria-hidden="true">
                {sellerSummary.slice(0, 1)}
              </div>
            )}
            <div>
              <p className="product-detail__seller-name">{sellerSummary}</p>
              {sellerSecondary ? (
                <p className="product-detail__seller-role">{sellerSecondary}</p>
              ) : null}
              {product?.seller?.headline ? (
                <p className="product-detail__seller-role">{product.seller.headline}</p>
              ) : null}
            </div>
          </div>
          {product?.seller?.about ? (
            <p className="product-detail__seller-about">{product.seller.about}</p>
          ) : null}
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{inStock ? 'Available to ship' : 'Restocking soon'}</dd>
            </div>
            <div>
              <dt>Delivery estimate</dt>
              <dd>{inStock ? '3-5 business days' : 'Dispatch once restocked'}</dd>
            </div>
            <div>
              <dt>Return policy</dt>
              <dd>Request returns from your orders page after delivery.</dd>
            </div>
            {product?.seller?.website ? (
              <div>
                <dt>Seller site</dt>
                <dd>
                  <a href={product.seller.website} target="_blank" rel="noreferrer">
                    Visit store profile
                  </a>
                </dd>
              </div>
            ) : null}
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
            <dd>{product.category ?? 'Uncategorised'}</dd>
          </div>
          <div>
            <dt>Seller</dt>
            <dd>{product.seller?.name ?? 'Marketplace partner'}</dd>
          </div>
          <div>
            <dt>Dispatch</dt>
            <dd>{inStock ? 'Usually within 24 hours' : 'Pending restock confirmation'}</dd>
          </div>
          {specEntries.map((entry) => (
            <div key={entry.key}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="product-detail__section">
        <div className="product-detail__reviews-header">
          <h2>Customer reviews</h2>
          <span>{formatRatingLabel(ratingValue)} | {reviewCount ? `${formatNumber(reviewCount)} ratings` : 'New product'}</span>
        </div>
        {reviewItems.length ? (
          <div className="product-detail__reviews">
            {reviewItems.map((review) => (
              <article key={review.id} className="product-review">
                <div className="product-review__header">
                  <div>
                    <p className="product-review__author">{review.user?.name ?? 'FitSync member'}</p>
                    <p className="product-review__meta">
                      {formatDate(review.createdAt)} | {review.isVerifiedPurchase ? 'Verified purchase' : 'Community review'}
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

      {relatedProducts.length ? (
        <section className="product-detail__section">
          <div className="product-detail__reviews-header">
            <h2>Related products</h2>
            <span>Explore more from this category</span>
          </div>
          <div className="product-grid">
            {relatedProducts.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                onAddToCart={handleAddRelatedToCart}
                onBuyNow={handleBuyRelatedNow}
                onViewDetails={handleViewRelatedDetails}
              />
            ))}
          </div>
        </section>
      ) : null}

      {isZoomOpen && selectedImage ? (
        <div className="product-detail__zoom-overlay" role="presentation" onClick={() => setIsZoomOpen(false)}>
          <button
            type="button"
            className="product-detail__zoom-close"
            onClick={() => setIsZoomOpen(false)}
          >
            Close
          </button>
          <img
            src={selectedImage}
            alt={`${product.name} enlarged view`}
            className="product-detail__zoom-image"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
};

export default MarketplaceProductPage;
