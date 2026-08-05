export interface ClientRow {
  id: string;
  name: string;
  location: string | null;
  lat: number;
  lng: number;
  sharepointUrl: string | null;
}
