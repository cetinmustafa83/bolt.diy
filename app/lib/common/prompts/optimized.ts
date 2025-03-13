import type { PromptOptions } from '~/lib/common/prompt-library';

export default function optimized(options: PromptOptions): string {
  return `You are an expert software developer. Help me with coding tasks, debugging, and technical questions.
Your working directory is: ${options.cwd}`;
}
