import React, { useState } from "react";
import { ChevronDown, ChevronUp, ShieldAlert, KeyRound, Cable, ShieldCheck } from "lucide-react";

export const AuthorizationGuide: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  return (
    <div className="bg-[#11141b] border border-[#212633] rounded-xl p-4 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-[#f59e0b] flex-shrink-0" />
          <div>
            <h4 className="text-[13px] font-medium text-[#ededf0]">
              Approval needed on your phone
            </h4>
            <p className="text-xs text-[#9aa2b1] mt-0.5">
              Unlock the phone and confirm the dialog asking to trust this computer.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[#9aa2b1] hover:text-[#ededf0] p-1 rounded hover:bg-[#171b23] transition-colors duration-150"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-[#1c212c] grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="bg-[#0e1117] border border-[#1b202c] rounded-lg p-3 text-xs">
            <div className="flex items-center gap-2 text-[#ededf0] font-medium mb-1">
              <KeyRound className="w-4 h-4 text-[#9aa2b1]" />
              <span>1. Developer mode</span>
            </div>
            <p className="text-xs text-[#9aa2b1] leading-relaxed">
              Open <span className="text-[#ededf0]">Settings &gt; About phone</span> and tap <span className="text-[#ededf0]">Build number</span> seven times.
            </p>
          </div>

          <div className="bg-[#0e1117] border border-[#1b202c] rounded-lg p-3 text-xs">
            <div className="flex items-center gap-2 text-[#ededf0] font-medium mb-1">
              <Cable className="w-4 h-4 text-[#9aa2b1]" />
              <span>2. USB debugging</span>
            </div>
            <p className="text-xs text-[#9aa2b1] leading-relaxed">
              Under <span className="text-[#ededf0]">Developer options</span>, turn <span className="text-[#ededf0]">USB debugging</span> on.
            </p>
          </div>

          <div className="bg-[#0e1117] border border-[#1b202c] rounded-lg p-3 text-xs">
            <div className="flex items-center gap-2 text-[#ededf0] font-medium mb-1">
              <ShieldCheck className="w-4 h-4 text-[#9aa2b1]" />
              <span>3. Trust this computer</span>
            </div>
            <p className="text-xs text-[#9aa2b1] leading-relaxed">
              On the phone, tick <span className="text-[#ededf0]">Always allow from this computer</span> and tap <span className="text-[#ededf0]">Allow</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
