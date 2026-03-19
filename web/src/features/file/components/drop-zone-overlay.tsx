import { AnimatePresence, motion } from 'framer-motion';
import { Upload, FileText, Image as ImageIcon, Music, Video, Archive } from 'lucide-react';

interface DropZoneOverlayProps {
  isActive: boolean;
}

// Floating file-type icons that drift upward
const FLOAT_ICONS = [
  { id: 0, Icon: FileText,  left: '14%', delay: 0,    duration: 2.6 },
  { id: 1, Icon: ImageIcon, left: '28%', delay: 0.7,  duration: 2.2 },
  { id: 2, Icon: Music,     left: '50%', delay: 0.35, duration: 2.8 },
  { id: 3, Icon: Video,     left: '66%', delay: 1.05, duration: 2.4 },
  { id: 4, Icon: Archive,   left: '80%', delay: 0.55, duration: 2.0 },
];

// Tiny particle dots
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: `${6 + i * 6.5}%`,
  delay: i * 0.18,
  duration: 1.8 + (i % 4) * 0.3,
  size: i % 3 === 0 ? 6 : i % 3 === 1 ? 4 : 5,
}));

// Pulsing rings behind the upload icon
const RINGS = [0, 1, 2];

export function DropZoneOverlay({ isActive }: DropZoneOverlayProps) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="drop-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md"
        >
          {/* Ambient radial glow that pulses */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background:
                'radial-gradient(ellipse 55% 45% at 50% 50%, hsl(var(--primary) / 0.12) 0%, transparent 70%)',
            }}
          />

          {/* Main drop card */}
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="relative w-full max-w-sm mx-6"
          >
            {/* Animated glow ring around card */}
            <motion.div
              className="absolute -inset-px rounded-2xl pointer-events-none"
              animate={{
                boxShadow: [
                  '0 0 0 1.5px hsl(var(--primary) / 0.35), 0 0 24px hsl(var(--primary) / 0.12)',
                  '0 0 0 1.5px hsl(var(--primary) / 0.65), 0 0 40px hsl(var(--primary) / 0.22)',
                  '0 0 0 1.5px hsl(var(--primary) / 0.35), 0 0 24px hsl(var(--primary) / 0.12)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Card body */}
            <div className="relative rounded-2xl border-2 border-dashed border-primary/50 bg-card/70 overflow-hidden py-10 px-8">

              {/* ── Floating particles ── */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {PARTICLES.map((p) => (
                  <motion.div
                    key={p.id}
                    className="absolute rounded-full bg-primary/35"
                    style={{
                      left: p.left,
                      bottom: '-8px',
                      width: p.size,
                      height: p.size,
                    }}
                    animate={{
                      y: [0, -220],
                      opacity: [0, 0.55, 0],
                      scale: [0.4, 1.1, 0.3],
                    }}
                    transition={{
                      duration: p.duration,
                      delay: p.delay,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  />
                ))}
              </div>

              {/* ── Floating file-type icons ── */}
              <div className="absolute inset-x-0 bottom-0 h-28 pointer-events-none overflow-hidden">
                {FLOAT_ICONS.map(({ id, Icon, left, delay, duration }) => (
                  <motion.div
                    key={id}
                    className="absolute"
                    style={{ left, bottom: 0 }}
                    animate={{ y: [0, -120], opacity: [0, 0.22, 0] }}
                    transition={{
                      duration,
                      delay,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  >
                    <Icon className="h-5 w-5 text-primary" />
                  </motion.div>
                ))}
              </div>

              {/* ── Content ── */}
              <div className="relative flex flex-col items-center gap-5">

                {/* Upload icon + pulsing rings */}
                <div className="relative flex items-center justify-center">
                  {RINGS.map((i) => (
                    <motion.div
                      key={i}
                      className="absolute rounded-full border border-primary/20"
                      style={{ width: 60, height: 60 }}
                      animate={{ scale: [1, 2.6], opacity: [0.45, 0] }}
                      transition={{
                        duration: 2.2,
                        delay: i * 0.7,
                        repeat: Infinity,
                        ease: 'easeOut',
                      }}
                    />
                  ))}

                  {/* Bouncing icon circle */}
                  <motion.div
                    className="relative z-10 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner"
                    animate={{ y: [0, -7, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    {/* Subtle inner glow */}
                    <motion.div
                      className="absolute inset-0 rounded-2xl bg-primary/10"
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <Upload className="relative h-8 w-8 text-primary" />
                  </motion.div>
                </div>

                {/* Text */}
                <div className="text-center space-y-1.5">
                  <motion.p
                    className="text-base font-semibold leading-tight"
                    animate={{ opacity: [0.85, 1, 0.85] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    Drop to upload
                  </motion.p>
                  <p className="text-xs text-muted-foreground">
                    Files and folders will be added to the current location
                  </p>
                </div>

                {/* File / Folder pills */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                    Files
                  </span>
                  <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Folders
                  </span>
                </div>
              </div>

              {/* Corner accents */}
              <div className="absolute top-3 left-3 h-3.5 w-3.5 border-l-2 border-t-2 border-primary/40 rounded-tl-sm" />
              <div className="absolute top-3 right-3 h-3.5 w-3.5 border-r-2 border-t-2 border-primary/40 rounded-tr-sm" />
              <div className="absolute bottom-3 left-3 h-3.5 w-3.5 border-l-2 border-b-2 border-primary/40 rounded-bl-sm" />
              <div className="absolute bottom-3 right-3 h-3.5 w-3.5 border-r-2 border-b-2 border-primary/40 rounded-br-sm" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
