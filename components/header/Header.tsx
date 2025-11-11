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
    <div className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-500 text-sm">
      < motion.div
        whileHover={{ scale: 1.05 }
        }
        whileTap={{ scale: 1.0 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={handleCopy}
      >
        <p className="text-sm font-medium">Copy my Email</p>
        
      </motion.div >

    </div >
  );
};

export default HoverMotionComponent;