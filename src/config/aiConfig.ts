export interface AIModelConfig {
  apiKey: string;
  baseURL: string;
  modelName: string;
}

export interface AIModelsConfig {
  gemini: AIModelConfig;
  openai?: AIModelConfig;
  // Add more providers as needed
}

export const AI_MODELS: AIModelsConfig = {
  gemini: {
    apiKey: 'AIzaSyC2TMwG7ewvLrzZoNG5IKs12KOET26lrbA',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    modelName: 'gemini-2.0-flash'
  }
} as const;

export const getModelConfig = (provider: keyof AIModelsConfig): AIModelConfig => {
  const config = AI_MODELS[provider];
  if (!config) {
    throw new Error(`Configuration not found for provider: ${provider}`);
  }
  return config;
};