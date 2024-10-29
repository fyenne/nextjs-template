import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, CheckCircle } from 'lucide-react';

const HoverMotionComponent = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const textToCopy = "fyenne@hotmail.com"; // Replace with your actual contact info

  const handleCopy = () => {
    // Create a temporary textarea element
    const textarea = document.createElement('textarea');
    textarea.value = textToCopy;
    textarea.style.position = 'fixed'; // Avoid scrolling to bottom
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    
    try {
      // Select and copy the text
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      // Show success state
      setIsCopied(true);
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    } finally {
      // Clean up
      if (document.body.contains(textarea)) {
        document.body.removeChild(textarea);
      }
    }
  };

  return (
    <div className="relative inline-block">
      <motion.div
        className="cursor-pointer flex items-center gap-2"
        whileHover={{ scale: 1.5 }}
        whileTap={{ scale: 1.1 }}
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={handleCopy}
      >
        <p className="text-lg font-medium">Contact me</p>
        {isCopied ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </motion.div>
      
      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 rounded-md text-sm whitespace-nowrap"
      >
        {isCopied ? 'Copied!' : 'Click to copy'}
        {/* Triangle pointer */}
        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-black rotate-45" />
      </motion.div>
    </div>
  );
};

export default HoverMotionComponent;