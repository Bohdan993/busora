export interface LocationState {
  redirect?: string;
  notification?: string;
  notificationSeverity?: 'success' | 'error' | 'info' | 'warning';
}
