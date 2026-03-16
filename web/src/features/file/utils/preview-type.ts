export type PreviewType =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'text'
  | 'code'
  | 'none';

export function getPreviewType(mimeType: string, name: string): PreviewType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';

  const ext = name.split('.').pop()?.toLowerCase() || '';
  const codeExts = [
    'js',
    'jsx',
    'ts',
    'tsx',
    'py',
    'java',
    'c',
    'cpp',
    'h',
    'hpp',
    'cs',
    'go',
    'rs',
    'rb',
    'php',
    'swift',
    'kt',
    'html',
    'htm',
    'css',
    'scss',
    'sass',
    'json',
    'xml',
    'yaml',
    'yml',
    'toml',
    'sh',
    'bash',
    'sql',
    'vue',
    'svelte',
    'md',
    'markdown',
  ];
  const textExts = [
    'txt',
    'log',
    'csv',
    'env',
    'gitignore',
    'dockerignore',
    'editorconfig',
    'ini',
    'conf',
    'cfg',
  ];

  if (codeExts.includes(ext)) return 'code';
  if (textExts.includes(ext)) return 'text';
  if (mimeType.startsWith('text/')) return 'text';

  return 'none';
}
