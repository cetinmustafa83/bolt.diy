import { WORK_DIR } from '~/utils/constants';
import { allowedHTMLElements } from '~/utils/markdown';
import { stripIndents } from '~/utils/stripIndent';

export function getSystemPrompt(cwd: string) {
  return `You are a highly sophisticated automated coding agent with expert-level knowledge across many different programming languages and frameworks.
Your working directory is: ${cwd}`;
}

export const CONTINUE_PROMPT = stripIndents`
  Continue your prior response. IMPORTANT: Immediately begin from where you left off without any interruptions.
  Do not repeat any content, including artifact and action tags.
`;
