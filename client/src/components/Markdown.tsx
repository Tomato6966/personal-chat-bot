import React, { ReactNode, useReducer, useRef } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = React.useState<"Copied" | "Copy" | "Failed to Copy">("Copy");
    const timeout = useRef<NodeJS.Timeout | null>(null);
    return (
        <CopyToClipboard
            onCopy={(_text, result: boolean) => {
                setCopied(result ? "Copied" : "Failed to Copy");
                if (timeout.current) clearTimeout(timeout.current);
                timeout.current = setTimeout(() => setCopied("Copy"), 3000);
            }}
            text={text}
        >
            <button
                className={`copytoclipboard ${copied ? 'copied' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                {copied}
            </button>
        </CopyToClipboard>
    );
};

const MarkdownWithCopyButton = ({ entry }: { entry: ReactNode }) => {
    return (
        <ReactMarkdown
            components={{
                code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                        <div className="relative">
                            <CopyButton text={String(children).replace(/\n$/, '')} />
                            <SyntaxHighlighter
                                style={oneDark}
                                language={match[1]}
                                PreTag="div"
                                {...props}
                            >
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                        </div>
                    ) : (
                        <code className={className} {...props}>
                            {children}
                        </code>
                    );
                },
            }}
        >
            {entry}
        </ReactMarkdown>
    );
};

export default MarkdownWithCopyButton;
