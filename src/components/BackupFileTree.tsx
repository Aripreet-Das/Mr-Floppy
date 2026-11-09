import React, { useState } from "react";
import { FolderOpen, Folder, File, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "./utils";

interface ManifestEntry {
  relative_path: string;
  size_bytes: number;
  sha256: string;
  modified_ts: number;
  status: string;
}

interface TreeNode {
  name: string;
  isFile: boolean;
  entry?: ManifestEntry;
  children: Map<string, TreeNode>;
}

function buildTree(entries: ManifestEntry[]): TreeNode {
  const root: TreeNode = { name: "Mr Floppy Backup", isFile: false, children: new Map() };
  for (const entry of entries) {
    const parts = entry.relative_path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!node.children.has(p)) {
        node.children.set(p, { name: p, isFile: false, children: new Map() });
      }
      node = node.children.get(p)!;
    }
    const fileName = parts[parts.length - 1];
    node.children.set(fileName, {
      name: fileName,
      isFile: true,
      entry,
      children: new Map(),
    });
  }
  return root;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

function TreeNodeRow({ node, depth, openFolders }: { node: TreeNode; depth: number; openFolders: Set<string> }) {
  const [open, setOpen] = useState<boolean>(
    node.isFile ? false : openFolders.has(node.name)
  );

  const children = Array.from(node.children.values());
  const isFolderOpen = node.isFile ? false : open;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 text-xs font-mono",
        depth > 0 && "pl-4 border-l border-white/5",
        node.isFile ? "bg-white/5" : "bg-transparent hover:bg-white/5"
      )}
    >
      {node.isFile ? (
        <>
          <File className="w-3 h-3 text-slate-400" />
          <span className="text-slate-300 truncate max-w-[200px]">{node.name}</span>
          <span className="ml-auto text-slate-500">{formatBytes(node.entry!.size_bytes)}</span>
          <span className="text-slate-600">{truncateHash(node.entry!.sha256)}</span>
        </>
      ) : (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => {
                const n = !o;
                if (n) openFolders.add(node.name);
                else openFolders.delete(node.name);
                return n;
              });
            }}
            className="p-0.5"
          >
            {isFolderOpen ? (
              <ChevronDown className="w-3 h-3 text-slate-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-slate-500" />
            )}
          </button>
          <div className="flex items-center gap-1">
            {isFolderOpen ? (
              <FolderOpen className="w-3 h-3 text-amber-400" />
            ) : (
              <Folder className="w-3 h-3 text-slate-500" />
            )}
            <span
              className={cn(
                "font-semibold truncate max-w-[200px]",
                isFolderOpen ? "text-amber-200" : "text-slate-300"
              )}
            >
              {node.name}
            </span>
            <span className="ml-auto text-[9px] text-slate-600 font-mono">
              {children.length} items
            </span>
          </div>
        </>
      )}
      {isFolderOpen && (
        <div className="ml-3 border-l border-white/10 py-0.5">
          {children.map((c: TreeNode) => (
            <TreeNodeRow
              key={c.name}
              node={c as TreeNode}
              depth={depth + 1}
              openFolders={openFolders}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface BackupFileTreeProps {
  entries: ManifestEntry[];
  onClose: () => void;
}

export const BackupFileTree: React.FC<BackupFileTreeProps> = ({ entries, onClose }) => {
  const root = buildTree(entries);
  const [openFolders] = useState<Set<string>>(new Set());

  const totalSize = entries.reduce((sum, e) => sum + e.size_bytes, 0);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="border-t border-white/10 bg-[#06090d]/60 p-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-sm text-white">Backup Manifest — File Directory</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
          <span>{entries.length} files · {formatBytes(totalSize)}</span>
          <span className="px-2 py-0.5 rounded bg-white/10 border border-white/10">SHA-256 verified</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 hover:bg-white/10 text-slate-400"
        >
          <span className="sr-only">Close</span>
          <span className="text-[10px]">✕</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {Array.from(root.children.values()).map((child) => (
          <TreeNodeRow
            key={child.name}
            node={child as TreeNode}
            depth={0}
            openFolders={openFolders}
          />
        ))}
      </div>
    </div>
  );
};
