import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';
import { getShikiLanguage } from '@/features/file/utils/preview-type';
import { useTheme } from '@/components/ThemeProvider';
import { Loader2 } from 'lucide-react';

interface CodeViewerProps {
  content: string;
  fileName: string;
}

export function CodeViewer({ content, fileName }: CodeViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    let stale = false;

    const highlight = async () => {
      try {
        const lang = getShikiLanguage(fileName);
        const result = await codeToHtml(content, {
          lang,
          theme: theme === 'dark' ? 'github-dark' : 'github-light',
        });
        if (!stale) setHtml(result);
      } catch {
        // Fallback: if shiki fails for this language, show as plain text
        if (!stale) setHtml('');
      }
    };

    void highlight();
    return () => { stale = true; };
  }, [content, fileName, theme]);

  if (html === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Fallback to plain pre if shiki returned empty
  if (!html) {
    return (
      <pre className="w-full overflow-auto p-4 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap break-all">
        {content}
      </pre>
    );
  }

  return (
    <div
      className="w-full overflow-auto text-sm [&_pre]:p-4 [&_pre]:leading-relaxed [&_pre]:overflow-auto [&_code]:text-xs [&_code]:font-mono"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
