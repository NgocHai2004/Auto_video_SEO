import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 min for long pipeline ops
});

export default client;
