import type { PromptOptions } from '../prompt-library';

export default function optimized(options: PromptOptions) {
  return `You are an expert software developer. Help me with coding tasks, debugging, and technical questions.
Your working directory is: ${options.cwd}`;
}
