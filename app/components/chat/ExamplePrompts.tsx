import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { STARTER_TEMPLATES } from '~/utils/constants';
import type { Template } from '~/types/template';

const EXAMPLE_PROMPTS = [
  { text: 'Build a todo app in React using Tailwind' },
  { text: 'Build a simple blog using Astro' },
  { text: 'Create a cookie consent form using Material UI' },
  { text: 'Make a space invaders game' },
  { text: 'Make a Tic Tac Toe game in html, css and js only' },
];

interface FrameworkLinkProps {
  template: Template;
}

const FrameworkLink: React.FC<FrameworkLinkProps> = ({ template }) => (
  <a
    href={`/git?url=https://github.com/${template.githubRepo}.git`}
    data-state="closed"
    data-discover="true"
    className="items-center justify-center"
  >
    <div
      className={`inline-block ${template.icon} w-8 h-8 text-4xl transition-theme opacity-25 hover:opacity-100 hover:text-purple-500 dark:text-white dark:opacity-50 dark:hover:opacity-100 dark:hover:text-purple-400 transition-all`}
      title={template.label}
    />
  </a>
);

export function ExamplePrompts(sendMessage?: { (event: React.UIEvent, messageInput?: string): void | undefined }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div id="examples" className="relative flex flex-col gap-4 w-full max-w-3xl mx-auto flex justify-center mt-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 justify-center text-bolt-elements-textPrimary hover:text-purple-500 dark:text-white dark:hover:text-purple-400 transition-colors bg-transparent"
      >
        <span className="text-sm font-medium">Quick Start Templates</span>
        <motion.span
          className="i-ph:caret-down w-4 h-4"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col items-center gap-6">
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map((examplePrompt, index: number) => (
                  <button
                    key={index}
                    onClick={(event) => {
                      sendMessage?.(event, examplePrompt.text);
                    }}
                    className="border border-bolt-elements-borderColor rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-950 dark:hover:bg-gray-900 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary px-3 py-1 text-xs transition-theme"
                  >
                    {examplePrompt.text}
                  </button>
                ))}
              </div>
              
              <div className="flex flex-col items-center gap-4">
                <span className="text-sm text-gray-500">or start a blank app with your favorite stack</span>
                <div className="flex justify-center">
                  <div className="flex w-70 flex-wrap items-center justify-center gap-4">
                    {STARTER_TEMPLATES.map((template) => (
                      <FrameworkLink key={template.name} template={template} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
