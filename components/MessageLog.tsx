import React from 'react';

interface MessageLogProps {
  messages: string[];
  turn: number;
}

const MessageLog: React.FC<MessageLogProps> = ({ messages, turn }) => {
  return (
    <>
      {[...messages].reverse().map((msg, i) => {
        // Since the array is reversed, the first item (i=0) is the current turn's message
        const msgTurn = turn - i;
        const isSpecial = msg.includes('✨') || 
                         msg.includes('☢️') || 
                         msg.includes('⚛️') || 
                         msg.includes('⏱');

        return (
          <div 
            key={i} 
            className={`mb-1 border-b border-gray-800 pb-1 last:border-0 opacity-80 ${
              isSpecial ? 'text-neon-blue font-bold animate-pulse' : ''
            }`}
          >
            <span className="text-neon-purple mr-2">
              [{msgTurn > 0 ? msgTurn : 0}]
            </span>
            {msg}
          </div>
        );
      })}
    </>
  );
};

export default MessageLog;