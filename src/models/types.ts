export interface ModelInfo {
  id: string;
  provider: string;
  created?: number;
}

export interface ProviderInfo {
  name: string;
  hasModelList: boolean;
}
