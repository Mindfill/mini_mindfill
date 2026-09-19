import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * The standard "content has arrived" transition, so every section of the app
 * settles in the same way instead of snapping into place. Matches the fade
 * used between secondary lesson pages.
 */
export default function PageFade({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
