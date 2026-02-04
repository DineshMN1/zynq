"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Upload, Cloud, FileUp } from "lucide-react";

interface DropZoneOverlayProps {
  isActive: boolean;
}

export function DropZoneOverlay({ isActive }: DropZoneOverlayProps) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-50 flex items-center justify-center rounded-xl border-3 border-dashed border-primary bg-gradient-to-b from-primary/10 to-primary/5 backdrop-blur-md"
        >
          <div className="flex flex-col items-center gap-4">
            {/* Animated cloud icon */}
            <motion.div
              initial={{ y: 10, scale: 0.9 }}
              animate={{ y: 0, scale: 1 }}
              transition={{
                duration: 0.3,
                type: "spring",
                stiffness: 200,
              }}
              className="relative"
            >
              <div className="h-24 w-24 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Cloud className="h-12 w-12 text-primary" />
              </div>

              {/* Floating upload indicator */}
              <motion.div
                animate={{
                  y: [0, -8, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -bottom-2 -right-2 h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg"
              >
                <FileUp className="h-5 w-5 text-primary-foreground" />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center space-y-2"
            >
              <p className="text-xl font-semibold text-primary">
                Drop files here to upload
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Release to upload files to the current folder
              </p>
            </motion.div>

            {/* Decorative dots */}
            <div className="flex gap-2 mt-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                  className="h-2 w-2 rounded-full bg-primary"
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
