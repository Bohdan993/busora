export interface City {
  readonly id?: string;
  label: string;
  value: string;
  groupBy: string;
  countryId: string;
  sorting?: Object[];
}
