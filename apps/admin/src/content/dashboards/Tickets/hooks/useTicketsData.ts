import { useGetTicketAttributesQuery } from 'src/services/ticket';
import { useGetCurrenciesQuery } from 'src/services/currencies';
import { useGetCitiesQuery } from 'src/services/cities';
import { useGetDiscountsQuery } from 'src/services/discounts';
import { useGetAgentsQuery } from 'src/services/agents';

export const useTicketsData = () => {
  const {
    data: ticketAttributesData,
    error: ticketAttributesError,
    isError: ticketAttributesIsError,
    isLoading: ticketAttributesIsLoading,
    refetch: refetchAttributes
  } = useGetTicketAttributesQuery(undefined, {
    refetchOnFocus: false,
    refetchOnReconnect: false
  });

  const {
    data: currenciesData,
    error: currenciesError,
    isError: currenciesIsError,
    isLoading: currenciesIsLoading,
    refetch: refetchCurrencies
  } = useGetCurrenciesQuery(undefined, {
    refetchOnFocus: false,
    refetchOnReconnect: false
  });

  const {
    data: citiesData,
    error: citiesError,
    isError: citiesIsError,
    isLoading: citiesIsLoading,
    refetch: refetchCities
  } = useGetCitiesQuery(undefined, {
    refetchOnFocus: false,
    refetchOnReconnect: false
  });

  const {
    data: discountsData,
    error: discountsError,
    isError: discountsIsError,
    isLoading: discountsIsLoading,
    refetch: refetchDiscounts
  } = useGetDiscountsQuery(undefined, {
    refetchOnFocus: false,
    refetchOnReconnect: false
  });

  const {
    data: agentsData,
    error: agentsError,
    isError: agentsIsError,
    isLoading: agentsIsLoading,
    refetch: refetchAgents
  } = useGetAgentsQuery(undefined, {
    refetchOnFocus: false,
    refetchOnReconnect: false
  });

  return {
    ticketAttributes: {
      data: ticketAttributesData,
      error: ticketAttributesError,
      isError: ticketAttributesIsError,
      isLoading: ticketAttributesIsLoading,
      refetch: refetchAttributes
    },
    currencies: {
      data: currenciesData,
      error: currenciesError,
      isError: currenciesIsError,
      isLoading: currenciesIsLoading,
      refetch: refetchCurrencies
    },
    cities: {
      data: citiesData,
      error: citiesError,
      isError: citiesIsError,
      isLoading: citiesIsLoading,
      refetch: refetchCities
    },
    discounts: {
      data: discountsData,
      error: discountsError,
      isError: discountsIsError,
      isLoading: discountsIsLoading,
      refetch: refetchDiscounts
    },
    agents: {
      data: agentsData,
      error: agentsError,
      isError: agentsIsError,
      isLoading: agentsIsLoading,
      refetch: refetchAgents
    }
  };
};
