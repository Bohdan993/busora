'use client';

import { useSearchParams } from 'next/navigation';
import { SearchForm } from './SearchForm';

/** The search form prefilled from ?from=&to= (links from routes and cards). */
export function SearchFormFromUrl() {
  const params = useSearchParams();
  const originId = Number(params.get('from')) || undefined;
  const destinationId = Number(params.get('to')) || undefined;

  return (
    <SearchForm
      key={`${originId}-${destinationId}`}
      initial={{ originId, destinationId }}
    />
  );
}
