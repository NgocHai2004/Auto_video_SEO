import client from './client';
import type { BackgroundsResponse, VoicesResponse } from '../types';

export async function getBackgrounds(): Promise<string[]> {
  const response = await client.get<BackgroundsResponse>('/backgrounds');
  return response.data.backgrounds;
}

export async function getVoices(): Promise<string[]> {
  const response = await client.get<VoicesResponse>('/voices');
  return response.data.voices;
}
