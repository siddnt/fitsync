import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Hero from './sections/Hero.jsx';
import RevenueStreams from './sections/RevenueStreams.jsx';
import RoleHighlights from './sections/RoleHighlights.jsx';
import { useGetGymsQuery } from '../../services/gymsApi.js';
import { useGetMarketplaceCatalogQuery } from '../../services/marketplaceApi.js';
import { formatCurrency, formatNumber } from '../../utils/format.js';
import './LandingPage.css';

const LandingPage = () => {
  const { data: gymsResponse, isLoading: gymsLoading } = useGetGymsQuery({});
  const { data: marketplaceResponse, isLoading: productsLoading } = useGetMarketplaceCatalogQuery({
    pageSize: 6,
    sort: 'featured',
  });

  const gyms = Array.isArray(gymsResponse?.data?.gyms) ? gymsResponse.data.gyms : [];
  const products = Array.isArray(marketplaceResponse?.data?.products) ? marketplaceResponse.data.products : [];

  const featuredGyms = useMemo(() => (
    [...gyms]
      .sort((left, right) => {
        const leftScore = Number(left?.analytics?.rating ?? 0) + (left?.sponsorship?.status === 'active' ? 2 : 0);
        const rightScore = Number(right?.analytics?.rating ?? 0) + (right?.sponsorship?.status === 'active' ? 2 : 0);
        return rightScore - leftScore;
      })
      .slice(0, 3)
  ), [gyms]);

  const topProducts = useMemo(() => (
    [...products]
      .sort((left, right) => {
        const leftScore = Number(left?.stats?.soldLast30Days ?? 0) + Number(left?.reviews?.averageRating ?? 0);
        const rightScore = Number(right?.stats?.soldLast30Days ?? 0) + Number(right?.reviews?.averageRating ?? 0);
        return rightScore - leftScore;
      })
      .slice(0, 3)
  ), [products]);

  const liveProofStats = useMemo(() => {
    const featuredCount = gyms.filter((gym) => gym?.sponsorship?.status === 'active').length;
    const publishedProducts = products.filter((product) => product?.stats?.inStock !== false).length;
    const averageGymRating = featuredGyms.length
      ? featuredGyms.reduce((sum, gym) => sum + Number(gym?.analytics?.rating ?? 0), 0) / featuredGyms.length
      : 0;

    return [
      {
        label: 'Featured gyms',
        value: gymsLoading ? '...' : formatNumber(featuredCount || featuredGyms.length),
        meta: 'Live listings connected to the gym explorer',
      },
      {
        label: 'Top products',
        value: productsLoading ? '...' : formatNumber(publishedProducts || topProducts.length),
        meta: 'Marketplace items with active merchandising signals',
      },
      {
        label: 'Average gym rating',
        value: gymsLoading ? '...' : (averageGymRating ? `${averageGymRating.toFixed(1)} / 5` : 'New'),
        meta: 'Pulled from the real gym discovery dataset',
      },
    ];
  }, [featuredGyms, gyms, gymsLoading, products, productsLoading, topProducts.length]);

  return (
    <div className="landing">
      <div className="noise-overlay"></div>
      <Hero />
      <section className="landing-proof">
        <div className="landing-proof__intro">
          <small>Live platform proof</small>
          <h2>Discovery, merchandised from real app data</h2>
          <p>
            The landing experience now pulls directly from the same gym and marketplace
            catalogues that power the rest of FitSync, so evaluation starts with real proof
            instead of isolated marketing copy.
          </p>
        </div>

        <div className="landing-proof__stats">
          {liveProofStats.map((stat) => (
            <article key={stat.label} className="landing-proof__stat">
              <small>{stat.label}</small>
              <strong>{stat.value}</strong>
              <span>{stat.meta}</span>
            </article>
          ))}
        </div>

        <div className="landing-proof__grid">
          <section className="landing-proof__panel">
            <div className="landing-proof__panel-header">
              <div>
                <small>Featured gyms</small>
                <h3>Places members are opening right now</h3>
              </div>
              <Link to="/gyms">View all gyms</Link>
            </div>
            <div className="landing-proof__cards">
              {featuredGyms.length ? featuredGyms.map((gym) => (
                <Link key={gym.id} className="landing-proof__card" to={`/gyms/${gym.id}`}>
                  <div>
                    <strong>{gym.name}</strong>
                    <span>{gym.city ?? 'Location pending'}</span>
                  </div>
                  <div className="landing-proof__card-meta">
                    <span>{gym.discovery?.label ?? 'Published'}</span>
                    <span>
                      {gym.pricing?.startingAt
                        ? `From ${formatCurrency(gym.pricing.startingAt)}`
                        : 'Pricing on page'}
                    </span>
                    <span>
                      {Number(gym?.analytics?.ratingCount ?? 0) > 0
                        ? `${Number(gym.analytics.rating ?? 0).toFixed(1)} / 5`
                        : 'New listing'}
                    </span>
                  </div>
                </Link>
              )) : (
                <div className="landing-proof__empty">
                  {gymsLoading ? 'Loading featured gyms...' : 'Featured gyms appear here when the live catalogue is populated.'}
                </div>
              )}
            </div>
          </section>

          <section className="landing-proof__panel">
            <div className="landing-proof__panel-header">
              <div>
                <small>Top marketplace products</small>
                <h3>Merchandising tied to the live catalog</h3>
              </div>
              <Link to="/marketplace">Open marketplace</Link>
            </div>
            <div className="landing-proof__cards">
              {topProducts.length ? topProducts.map((product) => (
                <Link key={product.id} className="landing-proof__card" to={`/marketplace/products/${product.id}`}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.seller?.name ?? 'Marketplace seller'}</span>
                  </div>
                  <div className="landing-proof__card-meta">
                    <span>{formatCurrency(product.price ?? 0)}</span>
                    <span>{formatNumber(product?.stats?.soldLast30Days ?? 0)} sold recently</span>
                    <span>
                      {Number(product?.reviews?.count ?? 0) > 0
                        ? `${Number(product.reviews.averageRating ?? 0).toFixed(1)} / 5`
                        : 'Fresh listing'}
                    </span>
                  </div>
                </Link>
              )) : (
                <div className="landing-proof__empty">
                  {productsLoading ? 'Loading marketplace proof...' : 'Top products appear here when the live catalog has sell-through data.'}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
      <RoleHighlights />
      <RevenueStreams />
      <section className="landing__cta">
        <h2>Ready to power your gym business?</h2>
        <p>Join FitSync to connect gym owners, trainers, and trainees in one platform.</p>
        <div className="landing__cta-buttons">
          <Link to="/auth/register" className="primary-button">
            Create an account
          </Link>
          <Link to="/gyms" className="secondary-button">
            Explore gyms
          </Link>
        </div>
        <p className="landing__cta-note">
          Browse live gyms, marketplace products, and support-ready dashboards before creating an account.
        </p>
      </section>
    </div>
  );
};

export default LandingPage;
