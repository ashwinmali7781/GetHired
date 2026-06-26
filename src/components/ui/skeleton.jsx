import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("skeleton rounded-lg", className)}
      {...props}
    />
  );
}

export { Skeleton };
