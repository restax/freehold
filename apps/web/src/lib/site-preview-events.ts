/**
 * The designer and the preview pane sit side by side on /dashboard/website,
 * but their common parent is a server component and can't hold state between
 * them. A window event is the cheap way across: the designer fires it after a
 * successful save, the pane reloads its iframe.
 */
export const SITE_PREVIEW_REFRESH = "freehold:site-preview-refresh";
