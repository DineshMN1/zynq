export type PreviewType =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'markdown'
  | 'code'
  | 'text'
  | 'none';

const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs',
  'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'vue', 'svelte',
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'json', 'xml', 'yaml', 'yml', 'toml',
  'sh', 'bash', 'zsh', 'fish',
  'sql', 'graphql', 'gql',
  'dockerfile', 'makefile',
]);

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx']);

const TEXT_EXTENSIONS = new Set([
  'txt', 'log', 'csv', 'tsv', 'env', 'gitignore', 'dockerignore',
  'editorconfig', 'ini', 'conf', 'cfg', 'properties',
]);

export function getPreviewType(mimeType: string, name: string): PreviewType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';

  const ext = name.split('.').pop()?.toLowerCase() || '';

  if (MARKDOWN_EXTENSIONS.has(ext)) return 'markdown';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  if (mimeType.startsWith('text/')) return 'text';

  return 'none';
}

/** Map file extension to shiki language id for syntax highlighting */
export function getShikiLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    py: 'python', java: 'java', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    cs: 'csharp', go: 'go', rs: 'rust', rb: 'ruby', php: 'php',
    swift: 'swift', kt: 'kotlin', scala: 'scala',
    vue: 'vue', svelte: 'svelte',
    html: 'html', htm: 'html', css: 'css', scss: 'scss', sass: 'sass', less: 'less',
    json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'fish',
    sql: 'sql', graphql: 'graphql', gql: 'graphql',
    dockerfile: 'dockerfile', makefile: 'makefile',
    md: 'markdown', markdown: 'markdown', mdx: 'mdx',
  };
  return map[ext] || 'text';
}
