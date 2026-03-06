import React, { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface CardProps extends HTMLMotionProps<"div"> {
    children: ReactNode;
    glass?: boolean;
    className?: string;
    noPadding?: boolean;
}

const Card: React.FC<CardProps> = ({ 
    children, 
    glass = true, 
    className = '', 
    noPadding = false,
    ...props 
}) => {
    // Base classes for the card architecture
    const baseClasses = `
        soft-card 
        overflow-hidden
        ${noPadding ? '' : 'p-6'}
    `;

    // Combine base classes with user-provided className
    const combinedClasses = `${baseClasses.replace(/\s+/g, ' ').trim()} ${className}`.trim();

    return (
        <motion.div
            className={combinedClasses}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, boxShadow: '0 20px 40px -15px rgba(0,0,0,0.06)' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export default Card;
