/**
 * Design System Constants
 * Centralized design tokens for consistent styling across the application
 */

/**
 * Common class name combinations for consistent styling
 * Use these instead of repeating className strings across components
 */
export const designSystem = {
  // Input variants
  input: {
    base: "input-standard",
    withIcon: "input-with-icon",
    search: "input-with-icon surface-input focus-ring",
  },

  // Button variants  
  button: {
    sm: "btn-sm",
    md: "btn-md",
    lg: "btn-lg",
    primary: "btn-md bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "btn-md bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "btn-md border border-border/40 hover:bg-muted/50",
    ghost: "btn-md hover:bg-muted/50",
    success: "btn-sm bg-success/10 text-success border border-success/20 hover:bg-success/20 hover:border-success/30 dark:text-emerald-400",
  },

  // Card variants
  card: {
    base: "card-base",
    interactive: "card-interactive",
    featured: "card-featured",
    glass: "glass-card rounded-xl p-4",
  },

  // Badge variants
  badge: {
    default: "badge-default",
    primary: "badge-primary",
    success: "badge-success",
    category: "badge-pill bg-secondary/90 dark:bg-secondary/80 backdrop-blur-sm text-secondary-foreground",
  },

  // Container variants
  container: {
    default: "section-container",
    narrow: "section-narrow",
    wide: "section-wide",
  },

  // Background patterns
  background: {
    base: "surface-base",
    raised: "surface-raised",
    overlay: "surface-overlay",
    input: "surface-input",
    glass: "glass-card",
    glassSubtle: "glass-subtle",
  },

  // Panel patterns (consistent card styling)
  panel: {
    card: "panel-card",
    header: "panel-header",
    statBox: "stat-box",
  },

  // Hover effects
  hover: {
    lift: "hover-lift",
    scale: "hover-scale",
    glow: "hover-glow",
  },

  // Layout patterns
  layout: {
    page: "min-h-screen flex flex-col",
    pageContent: "flex-1",
    centered: "flex items-center justify-center",
    spaceBetween: "flex items-center justify-between",
  },

  // Form field wrapper
  formField: {
    wrapper: "space-y-2",
    label: "text-sm font-medium",
    description: "text-xs text-muted-foreground",
    error: "text-xs text-destructive",
  },

  // Header/Navigation
  nav: {
    header: "sticky top-3 z-50 mx-4 lg:mx-6",
    container: "max-w-7xl mx-auto",
    bar: "navbar-blur rounded-2xl border border-border/40 dark:border-border/30 shadow-lg shadow-black/5 dark:shadow-black/20",
    link: "px-3 py-2 text-sm font-medium text-muted-foreground rounded-lg transition-all hover:text-foreground hover:bg-muted/50 hover-scale",
    linkActive: "px-3 py-2 text-sm font-medium text-foreground rounded-lg bg-muted/50",
  },

  // Decorative elements
  decorative: {
    grid: "pattern-grid",
    orb: "blur-orb",
    orbPrimary: "blur-orb-primary",
    orbSuccess: "blur-orb-success",
    orbInfo: "blur-orb-info",
  },

  // Common transitions
  transition: {
    default: "transition-all duration-200",
    fast: "transition-all duration-150",
    slow: "transition-all duration-300",
    colors: "transition-colors duration-200",
  },

  // Text styles
  text: {
    h1: "text-3xl md:text-4xl font-bold tracking-tight",
    h2: "text-2xl md:text-3xl font-bold tracking-tight",
    h3: "text-xl md:text-2xl font-semibold",
    h4: "text-lg font-semibold",
    body: "text-base text-foreground",
    small: "text-sm text-muted-foreground",
    muted: "text-muted-foreground",
    balance: "text-balance",
  },

  // Loading states
  loading: {
    skeleton: "skeleton rounded-lg",
    spinner: "h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin",
  },
} as const;

/**
 * Common icon sizes for consistency
 */
export const iconSizes = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-6 w-6",
} as const;

/**
 * Common spacing values
 */
export const spacing = {
  section: {
    py: "py-8 md:py-12",
    pyLarge: "py-12 md:py-20",
    px: "px-4",
  },
  card: {
    p: "p-4",
    pLarge: "p-6",
  },
  gap: {
    xs: "gap-1",
    sm: "gap-2",
    md: "gap-4",
    lg: "gap-6",
    xl: "gap-8",
  },
} as const;

/**
 * Utility function to combine design system classes
 */
export function getClasses(...keys: string[]): string {
  return keys.join(" ");
}
