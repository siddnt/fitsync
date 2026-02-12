import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AnnouncementContext = createContext(null);

const defaultAnnouncement = {
  message: '🎯 December spotlight: sponsor your gym this week and double its homepage impressions.',
  ctaLabel: 'View sponsorships',
  ctaPath: '/dashboard/gym-owner/sponsorship',
};

export const AnnouncementProvider = ({ children }) => {
  const [announcement, setAnnouncement] = useState(defaultAnnouncement);
  const [isVisible, setIsVisible] = useState(true);

  const dismissAnnouncement = useCallback(() => setIsVisible(false), []);
  const resetAnnouncement = useCallback(() => setIsVisible(true), []);
  const updateAnnouncement = useCallback((partial = {}) => {
    setAnnouncement((prev) => ({ ...prev, ...partial }));
    setIsVisible(true);
  }, []);

  const value = useMemo(
    () => ({
      ...announcement,
      isAnnouncementVisible: isVisible,
      dismissAnnouncement,
      resetAnnouncement,
      updateAnnouncement,
    }),
    [announcement, dismissAnnouncement, isVisible, resetAnnouncement, updateAnnouncement],
  );

  return <AnnouncementContext.Provider value={value}>{children}</AnnouncementContext.Provider>;
};

export const useAnnouncement = () => {
  const context = useContext(AnnouncementContext);
  if (!context) {
    throw new Error('useAnnouncement must be used within an AnnouncementProvider.');
  }
  return context;
};
