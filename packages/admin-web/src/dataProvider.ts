import simpleRestProvider from 'ra-data-simple-rest';
import { DataProvider, fetchUtils } from 'react-admin';

const API_URL = 'http://localhost:8000/admin';

const httpClient = (url: string, options: fetchUtils.Options = {}) => {
  const token = localStorage.getItem('admin_token');
  if (!options.headers) {
    options.headers = new Headers({ Accept: 'application/json' });
  }
  if (token) {
    (options.headers as Headers).set('Authorization', `Bearer ${token}`);
  }
  return fetchUtils.fetchJson(url, options);
};

const baseDataProvider = simpleRestProvider(API_URL, httpClient);

export const dataProvider: DataProvider = {
  ...baseDataProvider,

  // Custom methods for dashboard stats
  getDashboardStats: async () => {
    const { json } = await httpClient(`${API_URL}/stats`);
    return json;
  },

  // Custom methods for economy
  getEconomyStats: async () => {
    const { json } = await httpClient(`${API_URL}/economy`);
    return json;
  },

  // Custom methods for logs
  getLogs: async (params: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset) query.set('offset', params.offset.toString());
    const { json } = await httpClient(`${API_URL}/logs?${query}`);
    return json;
  },
};

export default dataProvider;