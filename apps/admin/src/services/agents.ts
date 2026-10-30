import { type ApiResponse } from 'src/types/apiResponse';
import { type AgentOption } from 'src/types/tickets';
import { mainApi } from './index';

const agentApiWithTag = mainApi.enhanceEndpoints({ addTagTypes: ['Agent'] });

// GET /agents — list all agents (plus a synthetic "No agent" entry, id "0").
// Used to populate the agent dropdown in the tickets table.
export const agentApi = agentApiWithTag.injectEndpoints({
  endpoints: (builder) => ({
    getAgents: builder.query<ApiResponse<AgentOption[]>, void>({
      query: () => ({
        url: `/agents`
      }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ id }) => ({ type: 'Agent' as const, id })),
              { type: 'Agent', id: 'LIST' }
            ]
          : [{ type: 'Agent', id: 'LIST' }]
    })
  }),
  overrideExisting: false
});

export const { useGetAgentsQuery } = agentApi;
