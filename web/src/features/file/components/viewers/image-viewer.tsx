import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

interface ImageViewerProps {
  url: string;
  alt: string;
}

export function ImageViewer({ url, alt }: ImageViewerProps) {
  return (
    <PhotoProvider>
      <div className="flex items-center justify-center h-full w-full p-2">
        <PhotoView src={url}>
          <img
            src={url}
            alt={alt}
            className="max-w-full max-h-full object-contain cursor-zoom-in rounded-sm"
          />
        </PhotoView>
      </div>
    </PhotoProvider>
  );
}
