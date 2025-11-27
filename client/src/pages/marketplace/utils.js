export const deriveProductPricing = (product = {}) => {
  const baseMrp = product?.mrp ?? product?.price ?? 0;
  const sale = product?.price ?? baseMrp;

  const mrpValue = Number(baseMrp);
  const saleValue = Number(sale);

  const safeMrp = Number.isFinite(mrpValue) && mrpValue > 0
    ? mrpValue
    : (Number.isFinite(saleValue) && saleValue > 0 ? saleValue : 0);
  const safeSale = Number.isFinite(saleValue) && saleValue > 0 ? saleValue : safeMrp;

  if (!safeMrp || safeSale >= safeMrp) {
    return {
      mrp: safeMrp,
      price: safeSale,
      hasDiscount: false,
      discountPercentage: 0,
    };
  }

  const discount = Math.min(100, Math.max(0, Math.round(((safeMrp - safeSale) / safeMrp) * 100)));

  return {
    mrp: safeMrp,
    price: safeSale,
    hasDiscount: discount > 0,
    discountPercentage: discount,
  };
};

export const formatSoldCopy = (count = 0) => {
  if (!count) {
    return 'New arrival';
  }
  if (count >= 1000) {
    const compact = (count / 1000).toFixed(1).replace(/\.0$/, '');
    return `${compact}K+ bought last month`;
  }
  if (count >= 100) {
    const rounded = Math.round(count / 10) * 10;
    return `${rounded}+ bought last month`;
  }
  if (count === 1) {
    return '1 unit bought last month';
  }
  return `${count} bought last month`;
};

export const formatRatingLabel = (rating = 0) => {
  if (!rating) {
    return 'New';
  }
  const rounded = Math.round(rating * 10) / 10;
  return `${rounded.toFixed(1)} / 5`;
};
