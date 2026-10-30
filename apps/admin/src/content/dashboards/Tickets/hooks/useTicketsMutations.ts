import {
  useCreateTicketMutation,
  useDeleteTicketPassengerMutation,
  useDeleteTicketPdfMutation,
  useDownloadTicketMutation,
  useGenerateTicketMutation,
  useUpdateTicketMutation
} from 'src/services/ticket';

export const useTicketsMutations = () => {
  // Row delete removes a single passenger via
  // DELETE /tickets/passengers/:ticketId?passengerId=&type=. The backend
  // deletes the whole ticket when it was the last passenger on it.
  const [deleteFn, deleteResult] = useDeleteTicketPassengerMutation();
  const [updateFn, updateResult] = useUpdateTicketMutation();
  const [createFn, createResult] = useCreateTicketMutation();
  const [generateFn, generateResult] = useGenerateTicketMutation();
  const [deletePdfFn, deletePdfResult] = useDeleteTicketPdfMutation();
  const [downloadTicketFn, downloadTicketResult] = useDownloadTicketMutation();

  return {
    delete: {
      mutate: deleteFn,
      isError: deleteResult.isError,
      isSuccess: deleteResult.isSuccess,
      isLoading: deleteResult.isLoading,
      error: deleteResult.error,
      data: deleteResult.data,
      reset: deleteResult.reset
    },
    update: {
      mutate: updateFn,
      isError: updateResult.isError,
      isSuccess: updateResult.isSuccess,
      isLoading: updateResult.isLoading,
      error: updateResult.error,
      reset: updateResult.reset
    },
    create: {
      mutate: createFn,
      isError: createResult.isError,
      isSuccess: createResult.isSuccess,
      isLoading: createResult.isLoading,
      error: createResult.error,
      reset: createResult.reset
    },
    generate: {
      mutate: generateFn,
      isError: generateResult.isError,
      isSuccess: generateResult.isSuccess,
      isLoading: generateResult.isLoading,
      error: generateResult.error,
      data: generateResult.data,
      reset: generateResult.reset
    },
    deletePdf: {
      mutate: deletePdfFn,
      isError: deletePdfResult.isError,
      isSuccess: deletePdfResult.isSuccess,
      isLoading: deletePdfResult.isLoading,
      error: deletePdfResult.error,
      data: deletePdfResult.data,
      reset: deletePdfResult.reset
    },
    download: {
      mutate: downloadTicketFn,
      isError: downloadTicketResult.isError,
      isSuccess: downloadTicketResult.isSuccess,
      isLoading: downloadTicketResult.isLoading,
      error: downloadTicketResult.error,
      data: downloadTicketResult.data,
      reset: downloadTicketResult.reset
    }
  };
};
