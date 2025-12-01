import PropTypes from 'prop-types';
import { formatCurrency, formatNumber } from '../../../utils/format.js';
import { deriveProductPricing, formatSoldCopy, formatRatingLabel } from '../utils.js';

const ProductCard = ({ product, onAddToCart, onBuyNow, onViewDetails }) => {
  const pricing = deriveProductPricing(product);
  const rating = Number(product?.reviews?.averageRating ?? 0);
  const reviewCount = Number(product?.reviews?.count ?? 0);
  const ratingPercent = Math.min(100, Math.max(0, (rating / 5) * 100));
  const soldCopy = formatSoldCopy(product?.stats?.soldLast30Days ?? 0);
  const badge = product?.stats?.soldLast30Days >= 50 ? 'Popular pick' : product?.stats?.soldLast30Days >= 10 ? 'Trending' : null;
  const inStock = product?.stats?.inStock !== false;

  return (
    <article className="product-card">
      {badge ? <span className="product-card__badge">{badge}</span> : null}
      <button type="button" className="product-card__image" onClick={() => onViewDetails(product)}>
        {product?.image ? (
          <img src={product.image} alt={product?.name} loading="lazy" />
        ) : (
          <span className="product-card__placeholder">{product?.name?.slice(0, 1) ?? '?'}</span>
        )}
      </button>
      <div className="product-card__body">
        <button type="button" className="product-card__title" onClick={() => onViewDetails(product)}>
          {product?.name}
        </button>
        <p className="product-card__description">{product?.description}</p>

        <div className="product-card__rating" aria-label={`Rating ${formatRatingLabel(rating)}`}>
          <div className="product-card__stars" style={{ '--rating-fill': `${ratingPercent}%` }} aria-hidden>
            <span className="product-card__stars-base">★★★★★</span>
            <span className="product-card__stars-fill">★★★★★</span>
          </div>
          <span className="product-card__rating-value">{formatRatingLabel(rating)}</span>
          <span className="product-card__review-count">{reviewCount ? `${formatNumber(reviewCount)} reviews` : 'No reviews yet'}</span>
        </div>

        <div className="product-card__price-row">
          <div className="product-card__price-block">
            <span className="product-card__price">{formatCurrency(pricing.price)}</span>
            {pricing.hasDiscount ? (
              <>
                <span className="product-card__mrp">{formatCurrency(pricing.mrp)}</span>
                <span className="product-card__discount">-{pricing.discountPercentage}%</span>
              </>
            ) : null}
          </div>
          <span className="product-card__sold" aria-label={soldCopy}>{soldCopy}</span>
        </div>

        <div className="product-card__meta">
          {product?.seller?.name ? (
            <span>Sold by <strong>{product.seller.name}</strong></span>
          ) : null}
          <span className={inStock ? 'product-card__stock' : 'product-card__stock product-card__stock--muted'}>
            {inStock ? 'In stock' : 'Out of stock'}
          </span>
        </div>
      </div>
      <div className="product-card__actions">
        <button
          type="button"
          className="product-card__action product-card__action--primary"
          onClick={() => onBuyNow(product)}
          disabled={!inStock}
        >
          Buy now
        </button>
        <button
          type="button"
          className="product-card__action product-card__action--secondary"
          onClick={() => onAddToCart(product)}
          disabled={!inStock}
        >
          Add to cart
        </button>
        <button type="button" className="product-card__link" onClick={() => onViewDetails(product)}>
          View details
        </button>
      </div>
    </article>
  );
};

ProductCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    description: PropTypes.string,
    image: PropTypes.string,
    price: PropTypes.number,
    mrp: PropTypes.number,
    stats: PropTypes.shape({
      soldLast30Days: PropTypes.number,
      inStock: PropTypes.bool,
    }),
    reviews: PropTypes.shape({
      averageRating: PropTypes.number,
      count: PropTypes.number,
    }),
    seller: PropTypes.shape({
      name: PropTypes.string,
    }),
  }).isRequired,
  onAddToCart: PropTypes.func.isRequired,
  onBuyNow: PropTypes.func.isRequired,
  onViewDetails: PropTypes.func.isRequired,
};

export default ProductCard;
