// The illustrative fleet on the home page. Busora is fictional, so are these
// coaches; the photos are credited on /attributions (imageCredits.json).

export const AMENITIES = [
  'wifi',
  'screens',
  'sockets',
  'climate',
  'lighting',
  'seats',
  'footrest',
  'luggage',
  'toilet',
  'payment'
] as const;
export type Amenity = (typeof AMENITIES)[number];

export interface Coach {
  model: string;
  image: string;
  year: number;
  emission: string;
  seats: string;
  stars: number;
  amenities: Amenity[];
}

const ON_BOARD: Amenity[] = [
  'wifi',
  'screens',
  'sockets',
  'climate',
  'seats',
  'toilet'
];

export const FLEET: Coach[] = [
  {
    model: 'Mercedes-Benz Tourismo',
    image: '/images/fleet/coach-1.jpg',
    year: 2021,
    emission: 'Euro 6',
    seats: '49 + 2',
    stars: 4,
    amenities: ON_BOARD
  },
  {
    model: 'Neoplan Cityliner',
    image: '/images/fleet/coach-2.jpg',
    year: 2022,
    emission: 'Euro 6',
    seats: '53 + 2',
    stars: 5,
    amenities: [...ON_BOARD, 'footrest']
  },
  {
    model: 'Van Hool TX16 Astron',
    image: '/images/fleet/coach-3.jpg',
    year: 2020,
    emission: 'Euro 6',
    seats: '50 + 2',
    stars: 4,
    amenities: ON_BOARD
  },
  {
    model: 'Irizar i8',
    image: '/images/fleet/coach-4.jpg',
    year: 2023,
    emission: 'Euro 6',
    seats: '51 + 2',
    stars: 5,
    amenities: [...ON_BOARD, 'footrest', 'lighting']
  }
];
