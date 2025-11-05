import { useMemo, useState, useEffect } from 'react';
import { useGetGymsQuery, useRecordImpressionMutation } from '../../services/gymsApi.js';
import GymList from './components/GymList.jsx';
import GymFilters from './components/GymFilters.jsx';
import GymHighlight from './components/GymHighlight.jsx';
import './GymExplorerPage.css';

const GymExplorerPage = () => {
  const [selectedGymId, setSelectedGymId] = useState(null);
  const [filters, setFilters] = useState({ search: '', city: '', amenities: [] });
  const { data, isFetching } = useGetGymsQuery(filters);
  const [recordImpression] = useRecordImpressionMutation();

  const fallbackGyms = useMemo(
    () => [
      {
        id: 'fallback-1',
        name: 'Pulse Strength Studio',
        owner: { name: 'Rhea Kapoor' },
        city: 'Mumbai',
        location: { address: 'Bandra West, Mumbai' },
        pricing: { mrp: 3499, discounted: 2999 },
        contact: { phone: '+91 98765 43210', email: 'pulse@fitsync.app' },
        schedule: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], open: '06:00', close: '23:00' },
        features: ['AC', 'Steam Room', 'Certified Trainers', 'Nutritionist'],
        description: 'Premium strength and conditioning gym with curated group classes.',
        reviews: [
          { id: 'r1', authorName: 'Aditya', rating: 5, comment: 'Great trainers and ambience.' },
          { id: 'r2', authorName: 'Kavya', rating: 4, comment: 'Loved the curated workout plans.' },
        ],
      },
      {
        id: 'fallback-2',
        name: 'Urban Grind Fitness',
        owner: { name: 'Neeraj Singh' },
        city: 'Bengaluru',
        location: { address: 'Indiranagar, Bengaluru' },
        pricing: { mrp: 3199, discounted: 2799 },
        contact: { phone: '+91 91234 56789', email: 'urbangrind@fitsync.app' },
        schedule: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], open: '05:30', close: '22:30' },
        features: ['Parking', 'Showers', 'Functional Zone'],
        description: 'Functional training focussed gym with curated personal coaching.',
        reviews: [
          { id: 'r3', authorName: 'Nikhil', rating: 5, comment: 'Loved the functional training setup.' },
        ],
      },
    ],
    [],
  );

  const gyms = useMemo(() => {
    if (data?.gyms?.length) {
      return data.gyms;
    }

    const { search, city, amenities } = filters;
    return fallbackGyms.filter((gym) => {
      const matchesSearch = search
        ? gym.name.toLowerCase().includes(search.toLowerCase()) ||
          gym.owner?.name?.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchesCity = city ? gym.city?.toLowerCase().includes(city.toLowerCase()) : true;
      const matchesAmenities = amenities.length
        ? amenities.every((amenity) => gym.features?.includes(amenity))
        : true;
      return matchesSearch && matchesCity && matchesAmenities;
    });
  }, [data?.gyms, fallbackGyms, filters]);

  const selectedGym = useMemo(
    () => gyms.find((gym) => gym.id === selectedGymId) ?? gyms[0],
    [selectedGymId, gyms],
  );

  // Track impressions when a gym is viewed
  useEffect(() => {
    if (selectedGym?.id && !selectedGym.id.startsWith('fallback')) {
      recordImpression(selectedGym.id);
    }
  }, [selectedGym?.id, recordImpression]);

  return (
    <div className="gym-explorer">
      <aside className="gym-explorer__sidebar">
        <GymFilters filters={filters} onChange={setFilters} />
        <GymList
          gyms={gyms}
          isLoading={isFetching}
          onSelect={setSelectedGymId}
          selectedGymId={selectedGym?.id ?? null}
        />
      </aside>
      <section className="gym-explorer__detail">
        <GymHighlight gym={selectedGym} isLoading={isFetching} />
      </section>
    </div>
  );
};

export default GymExplorerPage;
