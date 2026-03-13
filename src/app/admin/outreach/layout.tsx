import OutreachFloatingChat from "@/components/admin/OutreachFloatingChat";

export default function OutreachLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <OutreachFloatingChat />
    </>
  );
}
