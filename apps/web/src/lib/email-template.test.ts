import { describe, expect, it } from "vitest";
import { renderLiteMarkdown } from "./email-template";

describe("renderLiteMarkdown", () => {
  it("renders bold, italic, and headings", () => {
    expect(renderLiteMarkdown("**bold** and _italic_")).toContain(
      "<strong>bold</strong> and <em>italic</em>",
    );
    expect(renderLiteMarkdown("# Big\n\nBody")).toContain("Big</p>");
  });

  it("renders a [text](url) link inline", () => {
    const html = renderLiteMarkdown("Reach us at [our site](https://example.com/x?a=1&b=2).");
    expect(html).toContain('<a href="https://example.com/x?a=1&amp;b=2"');
    expect(html).toContain(">our site</a>");
  });

  it("renders a ![alt](url) line as its own image block, not wrapped in a <p>", () => {
    const html = renderLiteMarkdown("![Team photo](https://example.com/team.jpg)");
    expect(html).toBe(
      '<img src="https://example.com/team.jpg" alt="Team photo" style="max-width:100%;height:auto;border-radius:8px;margin:0 0 14px;display:block;" />',
    );
  });

  it("escapes markup inside link text and image alt text", () => {
    const html = renderLiteMarkdown("[<script>](https://example.com)");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
