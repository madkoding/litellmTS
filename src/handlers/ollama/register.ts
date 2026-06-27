import { OllamaHandler } from './index';
import { makeOllamaModelProvider } from './models';
import { registerModelProvider } from '../../models';
import { registerCompletionHandler } from '../../registry';

registerModelProvider('ollama', makeOllamaModelProvider('ollama'));
registerModelProvider('ollama_local', makeOllamaModelProvider('ollama_local'));
registerCompletionHandler('ollama/', OllamaHandler);
registerCompletionHandler('ollama_local/', OllamaHandler);
