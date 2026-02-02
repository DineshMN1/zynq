"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Upload } from "lucide-react";

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
          className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-3 text-primary">
            <motion.div
              initial={{ y: 8 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Upload className="h-12 w-12" />
            </motion.div>
            <p className="text-lg font-semibold">Drop files here to upload</p>
            <p className="text-sm text-muted-foreground">
              Files will be uploaded to the current folder
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
