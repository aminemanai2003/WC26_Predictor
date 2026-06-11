import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10", className)}>
      {title && (
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-white/60 text-sm sm:text-base">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
