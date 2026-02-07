"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Upload, FolderUp } from "lucide-react";

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
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          {/* Nextcloud-style drop zone */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2, type: "spring", stiffness: 300 }}
            className="w-full max-w-md mx-8"
          >
            <div className="relative rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-12">
              {/* Animated upload icon */}
              <div className="flex flex-col items-center gap-6">
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="relative"
                >
                  <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Upload className="h-10 w-10 text-primary" />
                  </div>

                  {/* Folder indicator */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: "spring" }}
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center shadow-lg"
                  >
                    <FolderUp className="h-4 w-4 text-white" />
                  </motion.div>
                </motion.div>

                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    Drop files here to upload
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Files and folders will be uploaded to the current location
                  </p>
                </div>

                {/* Visual hints */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Files
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Folders
                  </span>
                </div>
              </div>

              {/* Corner decorations */}
              <div className="absolute top-3 left-3 h-4 w-4 border-l-2 border-t-2 border-primary/30 rounded-tl" />
              <div className="absolute top-3 right-3 h-4 w-4 border-r-2 border-t-2 border-primary/30 rounded-tr" />
              <div className="absolute bottom-3 left-3 h-4 w-4 border-l-2 border-b-2 border-primary/30 rounded-bl" />
              <div className="absolute bottom-3 right-3 h-4 w-4 border-r-2 border-b-2 border-primary/30 rounded-br" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
