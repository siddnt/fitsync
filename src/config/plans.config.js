/**
 * Static configuration for the 3 fixed plans in the FitSync system
 */

const PLANS = [
  {
    id: "1",
    title: "Strength Training",
    description: "Build muscle and strength with our comprehensive strength training programs. Our expert trainers will guide you through progressive resistance exercises designed to increase your physical power and metabolic rate.",
    price: 2000,
    duration: {
      value: 1,
      unit: "months"
    },
    level: "all",
    category: "muscle gain",
    image: "/images/courses/strength_training.jpg",
    isActive: true,
    features: {
      sessions: 4,
      duration: "1.5 hour per session",
      price: "₹2000 per month"
    },
    rating: 4.5,
    reviews: 120,
    badge: "Popular"
  },
  {
    id: "2",
    title: "Yoga",
    description: "Find your inner peace and improve flexibility with our yoga classes. Combining physical postures, breathing exercises, and meditation, our yoga sessions are perfect for stress relief and improving overall wellness.",
    price: 1200,
    duration: {
      value: 1,
      unit: "months"
    },
    level: "beginner",
    category: "flexibility",
    image: "/images/courses/yoga.jpg",
    isActive: true,
    features: {
      sessions: 2,
      duration: "1 hour per session",
      price: "₹1200 per month"
    },
    rating: 4.0,
    reviews: 85
  },
  {
    id: "3",
    title: "Zumba",
    description: "Get fit and have fun with our high-energy Zumba classes. This Latin-inspired dance workout is perfect for burning calories while enjoying upbeat music. Suitable for all fitness levels, no dance experience needed!",
    price: 1500,
    duration: {
      value: 1,
      unit: "months"
    },
    level: "all",
    category: "cardio",
    image: "/images/courses/zumba.jpg",
    isActive: true,
    features: {
      sessions: 3,
      duration: "1 hour per session",
      price: "₹1500 per month"
    },
    rating: 4.8,
    reviews: 95,
    badge: "New"
  }
];

/**
 * Get a plan by its ID
 * @param {string} id - The plan ID
 * @returns {Object|null} The plan object or null if not found
 */
export const getPlanById = (id) => {
  return PLANS.find(plan => plan.id === id) || null;
};

/**
 * Get all available plans
 * @returns {Array} Array of all plans
 */
export const getAllPlans = () => {
  return PLANS;
};

export default PLANS; 