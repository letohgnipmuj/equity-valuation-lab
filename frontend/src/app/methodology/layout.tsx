import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Methodology",
    description: "Learn about the valuation methods used in this engine.",
};

export default function MethodologyLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
