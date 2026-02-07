// Profile options for enhanced dating profile

// User roles/personas - fun way to represent personality
export const ROLE_OPTIONS = [
  { value: 'shooter', label: '🎯 Shooter', description: 'Shoots their shot, likes freely' },
  { value: 'royalty', label: '👑 Royalty', description: 'Selective, quality over quantity' },
  { value: 'fire_starter', label: '🔥 Fire Starter', description: 'Always making the first move' },
  { value: 'social_butterfly', label: '🦋 Social Butterfly', description: 'Talks to everyone' },
  { value: 'chill_vibes', label: '🧘 Chill Vibes', description: 'Laid back and easy going' },
];

// Color mapping for roles (rings around avatars & selection buttons)
export const ROLE_COLORS: Record<string, { ring: string; background: string; border: string; text: string }> = {
  'shooter': { 
    ring: '#DC2626', 
    background: '#FEE2E2', 
    border: '#FCA5A5',
    text: '#991B1B'
  }, // Red
  'royalty': { 
    ring: '#9333EA', 
    background: '#F3E8FF', 
    border: '#D8B4FE',
    text: '#6B21A8'
  }, // Purple
  'fire_starter': { 
    ring: '#EA580C', 
    background: '#FFEDD5', 
    border: '#FDBA74',
    text: '#9A3412'
  }, // Orange
  'social_butterfly': { 
    ring: '#0891B2', 
    background: '#CFFAFE', 
    border: '#67E8F9',
    text: '#164E63'
  }, // Cyan
  'chill_vibes': { 
    ring: '#16A34A', 
    background: '#DCFCE7', 
    border: '#86EFAC',
    text: '#166534'
  }, // Green
};

export const EXERCISE_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'daily', label: 'Daily' },
];

export const DRINKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
];

export const SMOKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
];

export const PETS_OPTIONS = [
  { value: 'dog', label: 'Dog person' },
  { value: 'cat', label: 'Cat person' },
  { value: 'both', label: 'Both' },
  { value: 'neither', label: 'Neither' },
  { value: 'other', label: 'Other pets' },
];

export const DIET_OPTIONS = [
  { value: 'everything', label: 'Everything' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'other', label: 'Other' },
];

export const WANT_KIDS_OPTIONS = [
  { value: 'yes', label: 'Want kids' },
  { value: 'no', label: "Don't want kids" },
  { value: 'maybe', label: 'Maybe' },
  { value: 'have_kids', label: 'Have kids' },
];

export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

// Popular hobbies/interests for quick selection
export const POPULAR_HOBBIES = [
  'Hiking', 'Photography', 'Cooking', 'Gaming', 'Reading', 'Traveling',
  'Music', 'Dancing', 'Yoga', 'Art', 'Sports', 'Fitness',
  'Movies', 'Coffee', 'Wine', 'Concerts', 'Museums', 'Theater',
  'Beach', 'Mountains', 'Camping', 'Cycling', 'Running', 'Swimming',
  'Foodie', 'Baking', 'Gardening', 'DIY', 'Fashion', 'Animals',
];

export const POPULAR_INTERESTS = [
  'Technology', 'Science', 'Politics', 'History', 'Philosophy', 'Psychology',
  'Business', 'Entrepreneurship', 'Environment', 'Social causes', 'Volunteering',
  'Languages', 'Writing', 'Podcasts', 'Anime', 'K-pop', 'Fashion',
  'Interior design', 'Architecture', 'Food culture', 'Wine tasting', 'Coffee culture',
];

export const PERSONALITY_PROMPTS = [
  'My simple pleasures...',
  "I'm looking for someone who...",
  'The key to my heart is...',
  'My most controversial opinion...',
  'A perfect day for me is...',
  'I geek out on...',
  "We'll get along if...",
  'The way to win me over is...',
  'My love language is...',
  "I'm overly competitive about...",
  'Ideal Sunday morning...',
  'My go-to karaoke song...',
  'I want someone who...',
  "Don't hate me if I...",
  'Together we could...',
];
