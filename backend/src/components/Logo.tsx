import { ActivitySquare } from "lucide-react";

export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-6 w-6", md: "h-8 w-8", lg: "h-11 w-11" }[size];
  const iconDims = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-6 w-6" }[size];
  const text = { sm: "text-sm", md: "text-base", lg: "text-xl" }[size];

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex ${dims} items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-[0_0_0_1px_rgba(249,115,22,0.25)]`}
      >
        <ActivitySquare className={iconDims} strokeWidth={2.5} />
      </div>
      <span className={`${text} font-semibold tracking-tight text-white`}>SAFEIA</span>
    </div>
  );
}
