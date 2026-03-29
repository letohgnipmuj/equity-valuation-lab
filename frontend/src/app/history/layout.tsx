import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "History",
    description: "Browse past valuations.",
};

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
