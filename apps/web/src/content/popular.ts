// City pairs featured on the home page; prices and travel times come from
// GET /api/network. Ids are the seeded city ids (apps/api seed data).

export interface PopularPair {
  fromCityId: number;
  toCityId: number;
  /** A photo of the destination */
  image: string;
}

export const POPULAR_PAIRS: PopularPair[] = [
  { fromCityId: 1, toCityId: 8, image: '/images/cities/praha.jpg' },
  { fromCityId: 4, toCityId: 10, image: '/images/cities/ostrava.jpg' },
  { fromCityId: 5, toCityId: 9, image: '/images/cities/brno.jpg' },
  { fromCityId: 7, toCityId: 13, image: '/images/cities/plzen.jpg' },
  { fromCityId: 8, toCityId: 1, image: '/images/cities/kyiv.jpg' },
  { fromCityId: 10, toCityId: 4, image: '/images/cities/lviv.jpg' },
  { fromCityId: 13, toCityId: 5, image: '/images/cities/ternopil.jpg' },
  { fromCityId: 9, toCityId: 7, image: '/images/cities/uzhhorod.jpg' }
];
