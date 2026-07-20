import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Article body renderer.
 *
 * Markdown is stored, never HTML: react-markdown escapes raw HTML by default
 * (no `rehype-raw` here on purpose), so a post body can't inject scripts even
 * though authors are trusted. Styling leans on the existing globals.css
 * classes so posts match the rest of the site.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: (p) => <h2 className="subheading" style={{ marginTop: 32, marginBottom: 10 }} {...p} />,
          h3: (p) => <h3 style={{ fontSize: 17, fontWeight: 600, marginTop: 24, marginBottom: 8 }} {...p} />,
          p: (p) => <p style={{ lineHeight: 1.8, margin: "0 0 16px" }} {...p} />,
          ul: (p) => <ul style={{ lineHeight: 1.8, margin: "0 0 16px", paddingLeft: 22 }} {...p} />,
          ol: (p) => <ol style={{ lineHeight: 1.8, margin: "0 0 16px", paddingLeft: 22 }} {...p} />,
          a: ({ href, ...rest }) => {
            const external = !!href && !href.startsWith("/");
            return (
              <a
                href={href}
                style={{ color: "var(--cyan-edge)" }}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                {...rest}
              />
            );
          },
          blockquote: (p) => (
            <blockquote
              style={{ borderLeft: "3px solid var(--stone-border)", margin: "0 0 16px", padding: "4px 0 4px 16px", color: "var(--warm-gray)" }}
              {...p}
            />
          ),
          code: (p) => (
            <code style={{ background: "var(--stone-canvas)", borderRadius: 4, padding: "1px 5px", fontSize: "0.9em" }} {...p} />
          ),
          // Wide tables must scroll inside the article, never widen the page.
          table: (p) => (
            <div style={{ overflowX: "auto", margin: "0 0 16px" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%" }} {...p} />
            </div>
          ),
          th: (p) => <th style={{ textAlign: "left", padding: "6px 12px", borderBottom: "1px solid var(--stone-border)" }} {...p} />,
          td: (p) => <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--stone-border)" }} {...p} />,
          img: ({ alt, ...rest }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={alt ?? ""} style={{ maxWidth: "100%", height: "auto", borderRadius: "var(--r-card)" }} {...rest} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
