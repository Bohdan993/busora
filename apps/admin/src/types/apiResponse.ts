export type ApiResponse<T = void> = {
  status: string;
  data?: T;
  meta?: {
    totalRowCount?: number;
    startPage?: number;
    timestamp?: string;
  };
};
